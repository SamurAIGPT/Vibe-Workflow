import React, { useEffect, useState } from "react";
import { Handle, Position, useReactFlow, useStore, useUpdateNodeInternals } from "reactflow";
import { getRunId, getWorkflowId } from "./WorkflowStore";
import { toast } from "react-toastify";
import { CgOptions } from "react-icons/cg";
import { IoClose } from "react-icons/io5";
import { concatModels } from "./utility";
import { TbArrowMerge } from "react-icons/tb";

const inputHandles = [
  "concatInput",
];

const outputHandles = [
  "concatOutput",
];

const PromptConcate = ({ id, data, selected }) => {  
  const [selectedModel, setSelectedModel] = useState(concatModels[0]);
  const [connectedInputs, setConnectedInputs] = useState({});
  const [connectedOutputs, setConnectedOutputs] = useState({});
  const [formValues, setFormValues] = useState({});
  const [dropDown, setDropDown] = useState(0);
  const workflowId = getWorkflowId();
  const runId = getRunId();
  const nodeSchemas = data.nodeSchemas || {};
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useStore((state) => state.edges);
  const properties = selectedModel?.input_params?.properties || {};

  const initializeFormData = (schemaProperties) => {
    const initialData = {};
    const fieldEntries = Object.entries(schemaProperties || {});

    fieldEntries.forEach(([fieldName, fieldSchema]) => {
      if (fieldSchema.type === "array") {
        if (fieldSchema.items?.type === "object") {
          const examples = fieldSchema.examples;
          if (Array.isArray(examples) && examples.length > 0) {
            initialData[fieldName] = examples.map((ex) => ({ ...ex }));
          } else {
            initialData[fieldName] = [];
          }
        } else {
          initialData[fieldName] = fieldSchema.examples || [];
        }

      } else if (fieldSchema.type === "object") {
        const nestedProps = fieldSchema.properties || {};
        initialData[fieldName] = initializeFormData(nestedProps);

      } else if (fieldSchema.default !== undefined) {
        initialData[fieldName] = fieldSchema.default;

      } else if (fieldSchema.examples && fieldSchema.examples.length > 0) {
        initialData[fieldName] = fieldSchema.examples[0];

      } else {
        switch (fieldSchema.type) {
          case "boolean":
            initialData[fieldName] = false;
            break;
          case "int":
          case "number":
            initialData[fieldName] = 0;
            break;
          default:
            initialData[fieldName] = "";
        }
      }
    });

    return initialData;
  };
  
  useEffect(() => {
    const defaults = initializeFormData(properties);

    const validKeys = Object.keys(properties);
    const filteredFormValues = Object.entries(data.formValues || {}).reduce((acc, [key, val]) => {
      if (validKeys.includes(key)) acc[key] = val;
      return acc;
    }, {});

    const merged = Object.entries({ ...defaults, ...filteredFormValues }).reduce(
      (acc, [key, val]) => {
        const meta = properties[key];
        if (meta?.enum && !meta.enum.includes(val)) {
          acc[key] = meta.default ?? meta.enum[0] ?? "";
        } else {
          acc[key] = val;
        }
        return acc;
      },
      {}
    );
    setFormValues(merged);
  }, [selectedModel]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [formValues, id]);

  useEffect(() => {
    if (!data.formValues) return;
    const incoming = JSON.stringify(data.formValues);
    const current = JSON.stringify(formValues);
    if (incoming === current) return;

    const timer = setTimeout(() => {
      if (Object.entries(data.formValues || {}).length > 0) {
        setFormValues(data.formValues);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [data.formValues]);

  useEffect(() => {
    if (data?.onDataChange) {
      data.onDataChange(id, { formValues });
    }
  }, [formValues]);

  const handleDeleteNode = () => {
    if (window.confirm(`Are you sure you want to delete this ${id} node?`)) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      toast.info(`Deleted node ${id}`);
    };
  };

  const hasPrompt = properties && "prompt" in properties;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const validHandles = [
        hasPrompt && "concatInput",
      ].filter(Boolean);

      setEdges((prevEdges) =>
        prevEdges.filter((edge) => {
          if (edge.target !== id) return true;
          return validHandles.includes(edge.targetHandle);
        })
      );
    }, 2000);
    return () => clearTimeout(timeout);
  }, [hasPrompt, id, setEdges]);

  useEffect(() => {
    const connectedInputs = {};
    inputHandles.forEach((h) => {
      connectedInputs[h] = edges.some(
        (e) => e.target === id && e.targetHandle === h
      );
    });

    const connectedOutputs = {};
    outputHandles.forEach((h) => {
      connectedOutputs[h] = edges.some(
        (e) => e.source === id && e.sourceHandle === h
      );
    });

    setConnectedInputs(connectedInputs);
    setConnectedOutputs(connectedOutputs);
  }, [edges, id]);

  return (
    <div className={`nowheel group flex flex-col h-96 w-80 bg-[#0c0d0f] rounded-2xl border-2 relative transition-all duration-500 ease-in-out ${selected ? "border-white": "border-gray-500"}`}>
      <h3 className="absolute -top-5 left-0 text-gray-300 text-xs">Prompt Concatenator {id.replace(/^\D+/g, "")}</h3>
      <div className="flex items-center justify-between bg-[#151618] rounded-t-2xl border-b border-gray-800 p-2">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            className={`p-1 rounded cursor-pointer rotate-90 text-white bg-[#494c52]`}
          >
            <TbArrowMerge size={18} />
          </button>
          <button
            type="button"
            onClick={() => setDropDown(prev => prev === 1 ? 0: 1)}
            className="flex items-center gap-1 text-xs text-center cursor-pointer truncate text-white"
          >
            {selectedModel.name}
          </button>
          <button
            type="button"
            onClick={handleDeleteNode}
            className="font-bold p-1 hover:bg-[#494c52] rounded cursor-pointer text-gray-400 hover:text-red-500 ml-auto"
          >
            <IoClose size={18} />
          </button>
        </div>
      </div>
      <div className="flex flex-col w-full h-full">
        <textarea
          type="text"
          readOnly
          value={formValues?.prompt || ""}
          className="bg-transparent border border-gray-700 w-full !h-full p-2 text-xs text-white resize-none"
        />
      </div>
      {hasPrompt && (
        <>
          <Handle  
            type="target" 
            position={Position.Left} 
            id="concatInput" 
            style={{ 
              top: 100,
              width: 12,
              height: 12,
              transition: 'all 0.2s ease-in-out',
            }} 
            className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
              ${connectedInputs.concatInput 
                ? '!bg-blue-500 !border-white shadow-[0_0_20px_rgba(59,130,246,1)]' 
                : '!bg-black !border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
              }
              hover:!scale-125 hover:shadow-[0_0_20px_rgba(59,130,246,1)]
            `}
            data-type="blue"
          />
          <p 
            className={`absolute -left-7 top-[100px] text-xs text-blue-500 transition-opacity duration-200 ${
              data.activeHandleColor === "blue" 
                ? "opacity-100" 
                : "opacity-0 group-hover:opacity-100"
            }`}
          > 
            Text 
          </p>
        </>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="concatOutput" 
        style={{ 
          top: 100,
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !right-[-7px]
          ${connectedOutputs.concatOutput 
            ? '!bg-blue-500 !border-white shadow-[0_0_20px_rgba(59,130,246,1)]' 
            : '!bg-black !border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(59,130,246,1)]
        `}
        data-type="blue"
      />
      <p 
        className={`absolute -right-7 top-[100px] text-xs text-blue-500 transition-opacity duration-200 ${
          data.activeHandleColor === "blue" 
            ? "opacity-100" 
            : "opacity-0 group-hover:opacity-100"
        }`}
      > 
        Text 
      </p>
    </div>
  );
};

export default PromptConcate;
