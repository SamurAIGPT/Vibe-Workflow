'use client';

import React, { useEffect, useState } from "react";
import { Handle, Position, useReactFlow, useStore, useUpdateNodeInternals } from "reactflow";
import { BsArrowUpCircleFill } from "react-icons/bs";
import { apiNodeModels } from "./utility";
import { getRunId, getWorkflowId } from "./WorkflowStore";
import axios from "axios";
import { toast } from "react-toastify";
import { IoClose } from "react-icons/io5";
import { RiInputMethodLine } from "react-icons/ri";

const outputHandles = [
  "apiOutput",
];

const ApiNode = ({ id, data, selected }) => {
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || apiNodeModels[0]);
  const [connectedInputs, setConnectedInputs] = useState({});
  const [connectedOutputs, setConnectedOutputs] = useState({});
  const [formValues, setFormValues] = useState(data.formValues || {});
  const [taskData, setTaskData] = useState(apiNodeModels[0].input_params?.properties || {});
  const exposedHandles = data.exposedHandles || [];
  const [dropDown, setDropDown] = useState(0);
  const [loading, setLoading] = useState(0);
  const workflowId = getWorkflowId();
  const runId = getRunId();
  const nodeSchemas = data.nodeSchemas || {};
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useStore((state) => state.edges);
  const modelSchema = nodeSchemas?.categories?.api?.models[selectedModel.id];

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
    // Merge from both prop data and current local state
    const currentValues = { ...(data.formValues || {}), ...formValues };
    const filteredFormValues = Object.entries(currentValues).reduce((acc, [key, val]) => {
      if (validKeys.includes(key)) acc[key] = val;
      return acc;
    }, {});

    const merged = Object.entries({ ...defaults, ...filteredFormValues }).reduce(
      (acc, [key, val]) => {
        const meta = properties[key];
        if (meta?.enum) {
          const optionValues = meta.enum.map(opt => typeof opt === 'object' ? opt.value : opt);
          if (!optionValues.includes(val)) {
            const firstOption = meta.enum[0];
            acc[key] = meta.default ?? (typeof firstOption === 'object' ? firstOption.value : firstOption) ?? "";
          } else {
            acc[key] = val;
          }
        } else {
          acc[key] = val;
        }
        return acc;
      },
      {}
    );
    setFormValues(merged);
  };
  
  const fetchSchema = (workflowId) => {
    if (!workflowId) {
      toast.error("Failed to save workflow before running node");
      setLoading(0);
      return;
    }

    axios.get(`/api/workflow/${workflowId}/api-node-schemas`)
      .then((response) => {
        const schemas = response.data.api_node_schemas;
        if (schemas[id]) {
          const schemaObj = schemas[id]?.schema;
          const inputSchema = schemaObj?.input_schema;
          const modelProps = selectedModel.input_params?.properties || {};
          const configProps = {};
        
        Object.entries(modelProps).forEach(([key, schema]) => {
          configProps[key] = {
            ...schema,
            default: formValues[key] || schema.default || "",
            required: selectedModel.input_params?.required?.includes(key) || schema.required
          };
        });

        if (selectedModel.id === 'straico') {
          const currentDynamicSchemas = modelSchema?.dynamic_schemas || data.dynamicSchemas;
          if (currentDynamicSchemas) {
            const modelNames = Object.values(currentDynamicSchemas).map(m => m.model_id);
            if (configProps['model_name']) {
              configProps['model_name'] = {
                ...configProps['model_name'],
                enum: modelNames,
                allowManual: true
              };
            }
          }
        }

        if (selectedModel.id === 'runware') {
          const runwareModels = schemaObj?.dynamic_schemas?.models || inputSchema?.model_name?.enum || inputSchema?.model_id?.enum;
          if (runwareModels && configProps['model_name']) {
            configProps['model_name'] = {
              ...configProps['model_name'],
              enum: runwareModels,
              allowManual: true
            };
          }
        }

        const fullProps = {
          ...configProps,
          ...inputSchema,
        };
        addFormValuesInTaskData(fullProps);
        setTaskData(fullProps);

        const keysToExpose = Object.entries(inputSchema || {})
          .filter(([key, schema]) => schema?.ui?.can_link_from_node === true)
          .map(([key]) => key);

        if (keysToExpose.length > 0) {
          setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
              const currentExposed = n.data.exposedHandles || [];
              const uniqueExposed = [...new Set([...currentExposed, ...keysToExpose])];
              
              if (uniqueExposed.length !== currentExposed.length) {
                return { ...n, data: { ...n.data, exposedHandles: uniqueExposed } };
              }
            }
            return n;
          }));
        }
      } else {
        toast.warn(`No schema found for id: ${id}`);
      }
      setLoading(0);
    })
      .catch((error) => {
      setLoading(0);
      toast.error(error.response?.data?.detail || "Failed to fetch model details.");
      console.error(error);
    })
  };

  useEffect(() => {    
    let baseProperties = { ...(selectedModel.input_params?.properties || {}) };
    
    if (selectedModel.id === 'straico' && modelSchema?.dynamic_schemas) {
      const modelNames = Object.values(modelSchema.dynamic_schemas).map(m => m.model_id);
      if (baseProperties['model_name']) {
        baseProperties['model_name'] = { 
          ...baseProperties['model_name'], 
          enum: modelNames,
          allowManual: true 
        };
      }
    }

    if (selectedModel.id === 'runware' && modelSchema?.dynamic_schemas) {
      const taskType = formValues.task_type || "imageInference";
      const taskSchema = modelSchema.dynamic_schemas[taskType];
      
      if (taskSchema && taskSchema.schema?.input_schema) {
        const inputSchema = taskSchema.schema.input_schema;
        const modelEnum = inputSchema.model_name?.enum || inputSchema.model_id?.enum;
        
        if (modelEnum && baseProperties['model_name']) {
          baseProperties['model_name'] = { 
            ...baseProperties['model_name'], 
            enum: modelEnum,
            allowManual: true 
          };
        }
      }
    }
    setTaskData(baseProperties);
    
    // Ensure formValues has defaults for the current model
    if (Object.keys(formValues).length === 0 || (selectedModel.id === 'runware' && !formValues.task_type)) {
      addFormValuesInTaskData(baseProperties);
    }

    const requiredFields = selectedModel.input_params?.required || [];
    const allRequiredPresent = requiredFields.every(field => (formValues?.[field] || data?.formValues?.[field]) && (formValues?.[field] || data?.formValues?.[field]) !== "");
    
    if (requiredFields.length > 0 && allRequiredPresent) {
      fetchSchema(workflowId);
    }
  }, [selectedModel, modelSchema, formValues.task_type]);

  useEffect(() => {
    if (data.triggerRun) {
      handleRunSingleNode();
      data.onDataChange(id, { triggerRun: false });
    }

    if (data.triggerInputs) {
      fetchInputs();
      data.onDataChange(id, { triggerInputs: false });
    }

    if (data.selectedModel) {
      setSelectedModel(data.selectedModel);
    }
  }, [data.selectedModel, data.triggerRun, data.triggerInputs]);
  
  useEffect(() => {
    updateNodeInternals(id);
  }, [formValues, id]);

  const handleChange = (key, value) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setDropDown(-1);
  };

  const handleToggleHandle = (field) => {
    const current = data.exposedHandles || [];
    const isRemoving = current.includes(field);

    if (isRemoving) {
      setEdges((eds) => eds.filter(e => !(e.target === id && e.targetHandle === field)));
    }

    const updated = isRemoving
      ? current.filter(h => h !== field)
      : [...current, field];
    
    setNodes((nds) => nds.map((n) => 
      n.id === id ? { ...n, data: { ...n.data, exposedHandles: updated } } : n
    ));
  };

  useEffect(() => {
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
      data.onDataChange(id, { selectedModel, formValues, taskData, loading });
    }
  }, [selectedModel, formValues, taskData, loading]);

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
        toast.error(`Failed to get workflow status Image ${id.replace(/^\D+/g, "")}`);
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

      if (!modelSchema || !modelSchema.input_schema) {
        toast.error("No input schema found for this model");
        data.onDataChange(id, { isLoading: false });
        return;
      }
      const params = {};
      const inputSchema = modelSchema?.input_schema || {};
      const localSources = formValues || {};
      for (const [key, meta] of Object.entries(inputSchema)) {
        if (localSources.hasOwnProperty(key)) {
          params[key] = localSources[key];
        } else {
          params[key] = meta.default ?? null;
        }
      }

      const filteredInputParams = Object.fromEntries(
        Object.entries(formValues).filter(([key]) =>
          key !== "model_url" && key !== "api_key" && key !== "model_type" && key !== "model_name"
        )
      );
      params["params"] = filteredInputParams;

      const response = await axios.post(`/api/workflow/${workflow_id}/node/${id}/run`,
        {
          run_id: runId,
          model: selectedModel.id,
          params: params,
        }
      );
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

  const fetchInputs = async () => {
    const requiredFields = selectedModel.input_params?.required || [];
    const missingFields = requiredFields.filter(field => !formValues?.[field] || !formValues[field].trim());

    if (missingFields.length > 0) {
      toast.error(`${missingFields} required before fetching schema`);
      return;
    }

    setLoading(1);
    const workflow_id = await data.handleSaveWorkFlow();

    if (!workflow_id) {
      toast.error("Failed to save workflow before running node");
      setLoading(0);
      return;
    }
    fetchSchema(workflow_id);
  };

  useEffect(() => {
    const connectedOutputs = {};
    outputHandles.forEach((h) => {
      connectedOutputs[h] = edges.some(
        (e) => e.source === id && e.sourceHandle === h
      );
    });

    const connectedInputs = {};
    Object.keys(taskData).forEach((key) => {
      connectedInputs[key] = edges.some(
        (e) => e.target === id && e.targetHandle === key
      );
    });

    setConnectedOutputs(connectedOutputs);
    setConnectedInputs(connectedInputs);
  }, [edges, id, taskData]);  

  const hardcodedKeys = Object.keys(selectedModel.input_params?.properties || {});
  const filteredTaskDataEntries = Object.entries(taskData).filter(([key]) => !hardcodedKeys.includes(key));
  const minHeight = Math.max(208, 150 + filteredTaskDataEntries.length * 50);

  return (
    <div 
      style={{ minHeight }} 
      className={`nowheel group flex flex-col w-80 bg-[#0c0d0f] rounded-2xl border-2 relative transition-all duration-500 ease-in-out ${selected ? "border-white": "border-gray-500"}`}
    >
      <h3 className="absolute -top-5 left-0 text-gray-300 text-xs">Api {id.replace(/^\D+/g, "")}</h3>
      <div className="flex items-center justify-between bg-[#151618] rounded-t-2xl border-b border-gray-800 p-2">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            className={`p-1 rounded cursor-pointer text-white bg-transparent flex`}
          >
            <RiInputMethodLine size={18} />
          </button>
          <button
            type="button"
            onClick={() => setDropDown(prev => prev === 1 ? 0: 1)}
            className="flex items-center gap-1 text-white text-xs text-center cursor-pointer truncate"
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
      <div className="flex items-center flex-grow justify-center w-full h-full rounded transition-all duration-500">
        {data.isLoading ? (
          <div className="flex items-center justify-center w-full h-full overflow-hidden aspect-[1/1]">
            <div className="flex items-center justify-center text-xs skeleton w-full h-full">Generating...</div>
          </div>
        ) : data.errorMsg ? (
          <div className="text-red-300 text-sm p-2">
            {data.errorMsg || "Failed Generation"}
          </div>
        ) : data.resultUrl && !data.isLoading ? (
          (() => {
            const output = data.outputs?.[0];
            const isVideo = output?.type === 'video_url' || (data.resultUrl && (data.resultUrl.toLowerCase().endsWith('.mp4') || data.resultUrl.toLowerCase().endsWith('.webm') || data.resultUrl.toLowerCase().endsWith('.mov')));
        
            if (isVideo) {
              return (
                <video
                  src={data.resultUrl}
                  controls
                  className="w-full h-full rounded-md object-contain"
                />
              );
            }
            return (
              <img
                src={data.resultUrl}
                alt="Generated"
                className="w-full h-full rounded-md object-contain"
              />
            );
          })()
        ) : (
          <p className="text-gray-400 text-sm italic">Generation results appeared here...</p>
        )}
      </div>
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
      
      {(() => {
        let outputColor = "green";
        let activeClass = "!bg-green-500 !border-white shadow-[0_0_20px_rgba(34,197,94,1)]";
        let inactiveClass = "!bg-black !border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]";
        let labelText = "Image";
        let labelColor = "text-green-500";
        
        const output = data.outputs?.[0];
        const modelType = formValues.model_type; // || selectedModel.model_type?

        if (output?.type === 'text' || modelType === 'chat') {
          outputColor = "blue";
          activeClass = "!bg-blue-500 !border-white shadow-[0_0_20px_rgba(59,130,246,1)]";
          inactiveClass = "!bg-black !border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]";
          labelText = "Text";
          labelColor = "text-blue-500";
        } else if (output?.type === 'video_url' || modelType === 'video') {
          outputColor = "orange";
          activeClass = "!bg-orange-500 !border-white shadow-[0_0_20px_rgba(249,115,22,1)]";
          inactiveClass = "!bg-black !border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.5)]";
          labelText = "Video";
          labelColor = "text-orange-500";
        } else if (output?.type === 'audio_url' || modelType === 'audio') {
          outputColor = "yellow";
          activeClass = "!bg-yellow-500 !border-white shadow-[0_0_20px_rgba(234,179,8,1)]";
          inactiveClass = "!bg-black !border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]";
          labelText = "Audio";
          labelColor = "text-yellow-500";
        }

        return (
          <>
          <Handle 
            type="source" 
            position={Position.Right} 
            id="apiOutput" 
            style={{ 
              top: 100,
              width: 12,
              height: 12,
              transition: 'all 0.2s ease-in-out',
            }} 
            className={`!rounded-full !border-2 transition-all duration-200 !right-[-7px]
              ${connectedOutputs.apiOutput 
                ? activeClass
                : inactiveClass
              }
              hover:!scale-125
            `}
            data-type={outputColor}
          />
          <p 
            className={`absolute -right-10 top-[100px] text-xs ${labelColor} transition-opacity duration-200 ${
              data.activeHandleColor === outputColor
                ? "opacity-100" 
                : "opacity-0 group-hover:opacity-100"
            }`}
          > 
            {labelText}
          </p>
          </>
        );
      })()}

      {filteredTaskDataEntries.map(([key, meta], idx) => {
        const isExposed = connectedInputs[key] || exposedHandles.includes(key);
        return (
          <React.Fragment key={key}>
            <Handle 
              type="target" 
              position={Position.Left} 
              id={key} 
              style={{ 
                top: 150 + idx * 50,
                width: 12,
                height: 12,
                transition: 'all 0.2s ease-in-out',
                opacity: isExposed ? 1 : 0,
                pointerEvents: isExposed ? 'all' : 'none',
              }} 
              className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
                ${connectedInputs[key] 
                  ? '!bg-white !border-black shadow-[0_0_20px_rgba(255,255,255,1)]' 
                  : '!bg-black !border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]'
                }
                hover:!scale-125 hover:shadow-[0_0_20px_rgba(255,255,255,1)]
              `}
              data-type="white"
            />
            <p 
              className={`absolute -left-20 top-[${150 + idx * 50}px] text-xs text-white text-right w-16 transition-opacity duration-200 ${
                isExposed
                  ? "opacity-100" 
                  : "opacity-0 group-hover:opacity-100"
              }`}
               style={{ top: 150 + idx * 50, opacity: isExposed ? undefined : 0, pointerEvents: isExposed ? 'all' : 'none' }} 
            > 
              {key} 
            </p>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ApiNode;
