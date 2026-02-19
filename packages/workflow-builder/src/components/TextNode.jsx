import React, { useEffect, useMemo, useState, useRef } from "react";
import { Handle, Position, useReactFlow, useStore, useUpdateNodeInternals } from "reactflow";
import { BsArrowUpCircleFill } from "react-icons/bs";
import { textModels } from "./utility";
import axios from "axios";
import { getRunId, getWorkflowId } from "./WorkflowStore";
import { toast } from "react-toastify";
import { IoClose } from "react-icons/io5";
import UploadNode from "./UploadNode"
import { TfiText } from "react-icons/tfi";

const inputHandles = [
  "textInput",
  "textInput2",
  "textInput3",
];

const outputHandles = [
  "textOutput",
];

const TextGeneration = ({ id, data, selected }) => {
  const models = useMemo(() => {
    return data.nodeSchemas?.categories?.text?.models 
      ? Object.values(data.nodeSchemas.categories.text.models) 
      : [];
  }, [data.nodeSchemas]);
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || models[1] || models[0] || {});
  const [connectedInputs, setConnectedInputs] = useState({});
  const [connectedOutputs, setConnectedOutputs] = useState({});
  const [formValues, setFormValues] = useState(data.formValues || {});
  const [dropDown, setDropDown] = useState(0);
  const [loading, setLoading] = useState(0);
  const workflowId = getWorkflowId();
  const runId = getRunId();
  const nodeSchemas = data.nodeSchemas || {};
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useStore((state) => state.edges);
  const properties = nodeSchemas?.categories?.text?.models?.[selectedModel.id]?.input_schema?.schemas?.input_data?.properties;
  
  const textareaRef = useRef(null);
  
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const parentHeight = textarea.parentElement ? textarea.parentElement.clientHeight : 0;
      textarea.style.height = `${Math.max(textarea.scrollHeight, parentHeight)}px`;
    }
  }, [data.resultUrl]);

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

  const addFormValuesInTaskData = (properties) => {
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
  }
  useEffect(() => {
    setLoading(1);
    if (properties) {
      addFormValuesInTaskData(properties);
    }
    setLoading(0);
  }, [selectedModel]);

  useEffect(() => {
    if (data.selectedModel) {
      setSelectedModel(data.selectedModel);
    }

    if (data.triggerRun) {
      handleRunSingleNode();

      data.onDataChange(id, { triggerRun: false });
    }
  }, [data.selectedModel, data.triggerRun]);

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
    if (data?.onDataChange && data?.selectedModel?.id !== "text-passthrough") {
      data.onDataChange(id, { selectedModel, formValues, loading });
    }
  }, [selectedModel, formValues, loading]);

  const handleChange = (key, value) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setDropDown(-1);
  };

  const pollNodeStatus = (run_id) => {
    const interval = setInterval(() => {
      axios.get(`/api/workflow/run/${run_id}/status`)
      .then((response) => {
        const nodeData = response.data.nodes?.[id];
        if (!nodeData || nodeData.length === 0) return;
        const latest = nodeData[nodeData.length - 1];
        if (latest.status === "succeeded") {
          const output = latest.result.outputs;
          const val = output[0].value || "";
          data?.onDataChange?.(id, { outputs: output, resultUrl: val, isLoading: false, errorMsg: null });

          clearInterval(interval);
        }

        if (latest.status === "failed") {
          const outputs = latest?.result?.outputs;
          let errorMsg = "Generation failed";

          if (outputs && outputs[0]?.value?.error) {
            errorMsg = outputs[0].value.error; 
          }
          toast.error(`Node ${id} failed`);
          data.onDataChange(id, { isLoading: false, errorMsg });
          clearInterval(interval);
        }
      })
      .catch((error) => {
        console.log(error);
        clearInterval(interval);
        data.onDataChange(id, { isLoading: false });
        toast.error(`Failed to get workflow status Text ${id.replace(/^\D+/g, "")}`);
      });
    }, 3000);
  };

  const handleRunSingleNode = async () => {
    if (!runId) {
      toast.error("No run_id available!. Click 'Run All' button");
      return;
    }

    try {
      data.onDataChange(id, { isLoading: true });
      const workflow_id = await data.handleSaveWorkFlow();

      if (!workflow_id) {
        toast.error("Failed to save workflow before running node");
        data.onDataChange(id, { isLoading: false });
        return;
      }

      const modelSchema = nodeSchemas?.categories?.text?.models[selectedModel.id]?.input_schema?.schemas?.input_data;
      if (!modelSchema || !modelSchema.properties) {
        toast.error("No input schema found for this model");
        data.onDataChange(id, { isLoading: false });
        return;
      }
      const params = {};
      const inputSchema = modelSchema.properties;
      const localSources = formValues || {};
      for (const [key, meta] of Object.entries(inputSchema)) {
        if (localSources.hasOwnProperty(key)) {
          params[key] = localSources[key];
        } else {
          params[key] = meta.default ?? null;
        }
      }

      const response = await axios.post(`/api/workflow/${workflow_id}/node/${id}/run`, {
        run_id: runId,
        model: selectedModel.id,
        params: params,
      });
      pollNodeStatus(response.data.run_id);
    } catch(error) {
      data.onDataChange(id, { isLoading: false });
      toast.error(error.response?.data?.detail || "Error running node");
      console.error(error);
    };
  };

  const handleDeleteNode = () => {
    if (window.confirm(`Are you sure you want to delete this ${id} node?`)) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      toast.info(`Deleted node ${id}`);
    };
  };

  const hasPrompt = properties && "prompt" in properties && !data.selectedModel?.id.includes("passthrough");
  const hasImagesList = properties && "images_list" in properties && !data.selectedModel?.id.includes("passthrough");
  const hasImageUrl = properties && "image_url" in properties && !data.selectedModel?.id.includes("passthrough");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const validHandles = [
        hasPrompt && "textInput",
        hasImageUrl && "textInput2",
        hasImagesList && "textInput3"
      ].filter(Boolean);

      setEdges((prevEdges) =>
        prevEdges.filter((edge) => {
          if (edge.target !== id) return true;
          return validHandles.includes(edge.targetHandle);
        })
      );
      }, 2000);
    return () => clearTimeout(timeout);
  }, [hasPrompt, hasImageUrl, hasImagesList, id, setEdges]);

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
    <div style={{ minHeight: 210 }} className={`nowheel group flex flex-col flex-1 w-80 bg-[#0c0d0f] rounded-2xl border-2 relative transition-all duration-500 ease-in-out ${selected ? "border-white": "border-gray-500"}`}>
      <h3 className="absolute -top-5 left-0 text-gray-300 text-xs">Text {id.replace(/^\D+/g, "")}</h3>
      <div className="flex items-center justify-between bg-[#151618] rounded-t-2xl border-b border-gray-800 p-2">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            className={`p-1 rounded cursor-pointer text-white bg-transparent flex`}
          >
            <TfiText size={18} />
          </button>
          <button
            type="button"
            onClick={() => setDropDown(prev => prev === 1 ? 0: 1)}
            className="flex items-center gap-1 text-xs text-center text-white cursor-pointer truncate"
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
      {data.selectedModel?.id === "text-passthrough" ? (
        <div className="w-full flex-1 flex flex-col">
          <UploadNode id={id} data={data} formValues={formValues} setFormValues={setFormValues} selectedModel={selectedModel} loading={loading} uploadType="text" acceptType="text" />
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 w-full h-full p-2">
          {data.isLoading ? (
            <div className="flex flex-col gap-2 w-full h-full overflow-hidden">
              <div className="skeleton h-[10px] w-full"></div>
              <div className="skeleton h-[10px] w-full"></div>
              <div className="skeleton h-[10px] w-[60%]"></div>
              <div/>
              <div className="skeleton h-[10px] w-full"></div>
              <div className="skeleton h-[10px] w-[80%]"></div>
              <div className="skeleton h-[10px] w-[60%]"></div>
              <div/>
              <div className="skeleton h-[10px] w-full"></div>
              <div className="skeleton h-[10px] w-[80%]"></div>
              <div className="skeleton h-[10px] w-[60%]"></div>
            </div>
          ) : data.errorMsg ? (
            <div className="text-red-300 text-sm p-2">
              {data.errorMsg || "Failed Generation"}
            </div>
          ) : data.resultUrl && !data.isLoading ? ( 
            <textarea
              ref={textareaRef}
              readOnly
              value={data.resultUrl}
              className="w-full max-h-96 text-xs outline-none bg-transparent resize-none text-white overflow-y-auto custom-scrollbar"
            />
          ) : (
            <p className="text-gray-400 text-sm italic">Generation results appeared here...</p>
          )}
        </div>
      )}
      {data.selectedModel?.id !== "text-passthrough" && (
        <div className="flex items-center gap-2 border-t border-gray-700 mt-auto p-2 md:hidden">
          <button
            type="button"
            onClick={handleRunSingleNode}
            disabled={data.isLoading}
            className="text-xs flex items-center gap-2 cursor-pointer disabled:opacity-70 group disabled:cursor-not-allowed rounded text-black bg-white px-2 py-1 border border-gray-500 hover:text-white hover:bg-black"
          >
            {data.isLoading ? (
              <><div className="w-3 h-3 rounded-full border border-t-transparent group-hover:border-t-transparent border-black group-hover:border-white animate-spin"></div>Generating...</>
            ) : (
              <><BsArrowUpCircleFill size={16} /> Generate</>
            )}
          </button>
        </div>
      )}
      <Handle  
        type="target" 
        position={Position.Left} 
        id="textInput" 
        style={{ 
          top: 100,
          width: 12,
          height: 12,
          opacity: hasPrompt ? 1 : 0,
          pointerEvents: hasPrompt ? 'auto' : 'none',
          transition: 'all 0.2s ease-in-out',
        }}  
        className={`
          !rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.textInput 
            ? '!bg-blue-500 !border-white shadow-[0_0_20px_rgba(59,130,246,1)]' 
            : '!bg-black !border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(59,130,246,1)]
        `}
        data-type="blue"
      />
      {hasPrompt && (
        <p 
          className={`absolute -left-8 top-[100px] text-xs text-blue-500 transition-opacity duration-200 ${
            data.activeHandleColor === "blue" 
              ? "opacity-100" 
              : "opacity-0 group-hover:opacity-100"
          }`}
        > 
          Text 
        </p>
      )}
      
      <Handle  
        type="target" 
        position={Position.Left} 
        id="textInput2" 
        style={{ 
          top: 150,
          width: 12,
          height: 12,
          opacity: hasImageUrl ? 1 : 0,
          pointerEvents: hasImageUrl ? 'auto' : 'none',
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`
          !rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.textInput2 
            ? '!bg-green-500 !border-white shadow-[0_0_10px_rgba(34,197,94,0.8)]' 
            : '!bg-black !border-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_14px_rgba(34,197,94,1)]
        `}
        data-type="green"
      />
      {hasImageUrl && (
        <p 
          className={`absolute -left-10 top-[150px] text-xs text-green-500 transition-opacity duration-200 ${
            data.activeHandleColor === "green" 
              ? "opacity-100" 
              : "opacity-0 group-hover:opacity-100"
          }`}
        > 
          Image 
        </p>
      )}
      <Handle  
        type="target" 
        position={Position.Left} 
        id="textInput3" 
        style={{ 
          top: 200,
          width: 12,
          height: 12,
          opacity: hasImagesList ? 1 : 0,
          pointerEvents: hasImagesList ? 'auto' : 'none',
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`
          !rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.textInput3 
            ? '!bg-green-500 !border-white shadow-[0_0_10px_rgba(34,197,94,0.8)]' 
            : '!bg-black !border-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_14px_rgba(34,197,94,1)]
        `}
        data-type="green"
      />
      {hasImagesList && (
        <p 
          className={`absolute -left-10 top-[200px] text-xs text-green-500 transition-opacity duration-200 ${
            data.activeHandleColor === "green" 
              ? "opacity-100" 
              : "opacity-0 group-hover:opacity-100"
          }`}
        > 
          Image 
        </p>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="textOutput" 
        style={{ 
          top: 100,
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`
          !rounded-full !border-2 transition-all duration-200 !right-[-7px]
          ${connectedOutputs.textOutput 
            ? '!bg-blue-500 !border-white shadow-[0_0_10px_rgba(59,130,246,0.8)]' 
            : '!bg-black !border-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_14px_rgba(59,130,246,1)]
        `}
        data-type="blue"
      />
      <p 
        className={`absolute -right-8 top-[100px] text-xs text-blue-500 transition-opacity duration-200 ${
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

export default TextGeneration;
