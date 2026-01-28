"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Handle, Position, useReactFlow, useStore, useUpdateNodeInternals } from "reactflow";
import { getRunId, getWorkflowId } from "./WorkflowStore";
import { toast } from "react-toastify";
import { IoClose } from "react-icons/io5";
import { AiOutlineAudio } from "react-icons/ai";
import UploadNode from "./UploadNode";
import { audioModels, downloadFile } from "./utility";
import AudioPlayer from "./AudioPlayer";
import { BsArrowUpCircleFill } from "react-icons/bs";
import axios from "axios";
import { SlOptions } from "react-icons/sl";
import { MdOutlineFileDownload } from "react-icons/md";

const inputHandles = [
  "audioInput",
  "audioInput2",
  "audioInput3",
  "audioInput4",
];

const outputHandles = [
  "audioOutput",
];

const AudioGeneration = ({ id, data, selected }) => {
  const models = useMemo(() => {
    return data.nodeSchemas?.categories?.audio?.models 
      ? Object.values(data.nodeSchemas.categories.audio.models) 
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
  const properties = nodeSchemas?.categories?.audio?.models?.[selectedModel.id]?.input_schema?.schemas?.input_data?.properties;
  
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
  };

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
    if (data?.onDataChange && data?.selectedModel?.id !== "audio-passthrough") {
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

        if (nodeData[0].status === "succeeded") {
          const output = nodeData[0].result.outputs;
          const val = output[0].value || "";
          data?.onDataChange?.(id, { outputs: output, resultUrl: val, isLoading: false, errorMsg: null });

          clearInterval(interval);
        }

        if (nodeData[0].status === "failed") {
          const outputs = nodeData[0]?.result?.outputs;
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
    };

    try {
      data.onDataChange(id, { isLoading: true });
      const workflow_id = await data.handleSaveWorkFlow();

      if (!workflow_id) {
        toast.error("Failed to save workflow before running node");
        data.onDataChange(id, { isLoading: false });
        return;
      }

      const modelSchema = nodeSchemas?.categories?.audio?.models[selectedModel.id]?.input_schema?.schemas?.input_data;
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
  const hasImageUrl = properties && "image_url" in properties && !data.selectedModel?.id.includes("passthrough");
  const hasVideoUrl = properties && "video_url" in properties && !data.selectedModel?.id.includes("passthrough");
  const hasAudioUrl = properties && "audio_url" in properties && !data.selectedModel?.id.includes("passthrough");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const validHandles = [
        hasAudioUrl && "audioInput",
        hasPrompt && "audioInput2",
        hasImageUrl && "audioInput3",
        hasVideoUrl && "audioInput4",
      ].filter(Boolean);

      setEdges((prevEdges) =>
        prevEdges.filter((edge) => {
          if (edge.target !== id) return true;
          return validHandles.includes(edge.targetHandle);
        })
      );
      }, 2000);
    return () => clearTimeout(timeout);
  }, [hasAudioUrl, hasPrompt, hasImageUrl, hasVideoUrl, id, setEdges]);

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
      <h3 className="absolute -top-5 left-0 text-gray-300 text-xs">Audio {id.replace(/^\D+/g, "")}</h3>
      <div className="flex items-center justify-between bg-[#151618] rounded-t-2xl border-b border-gray-800 p-2">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            className={`p-1 rounded cursor-pointer text-white bg-transparent flex`}
          >
            <AiOutlineAudio size={18} />
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
      {data.selectedModel?.id === "audio-passthrough" ? (
        <div className="w-full h-full">
          <UploadNode id={id} data={data} formValues={formValues} setFormValues={setFormValues} selectedModel={selectedModel} loading={loading} uploadType="upload" acceptType="audio" />
        </div>
      ) : (
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
            <div className="w-full h-36 relative">
              <div 
                className="absolute top-2 right-2 z-10" 
                onClick={(e) => {e.stopPropagation();e.preventDefault();}}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDropDown(0);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setDropDown(prev => prev === 2 ? 0: 2)}
                  className="text-white bg-black/20 rounded-full cursor-pointer p-1 hover:bg-black/70"
                >
                  <SlOptions />
                </button>
                {dropDown === 2 && (
                  <div className="absolute right-0 top-7 z-10 flex flex-col gap-1 bg-[#1c1e21] border border-gray-500 p-1 rounded flex flex-col overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => downloadFile(data.resultUrl)}
                      className="flex items-center gap-2 text-[10px] text-white cursor-pointer p-1 bg-transparent hover:bg-[#494c52] rounded-xs"
                    >
                      <MdOutlineFileDownload size={14} /> Download
                    </button>
                  </div>
                )}
              </div>
              <AudioPlayer src={data.resultUrl} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">Generation results appeared here...</p>
          )}
        </div>
      )}
      {data.selectedModel?.id !== "audio-passthrough" && (
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
        id="audioInput" 
        style={{ 
          top: 70,
          opacity: hasAudioUrl ? 1 : 0,
          pointerEvents: hasAudioUrl ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }}  
        className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.audioInput 
            ? '!bg-yellow-500 !border-white shadow-[0_0_20px_rgba(255,215,0,1)]' 
            : '!bg-black !border-yellow-500 shadow-[0_0_20px_rgba(255,215,0,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(255,215,0,1)]
        `}
        data-type="yellow"
      />
      {hasAudioUrl && (
        <p 
          className={`absolute -left-7 top-[70px] text-xs text-yellow-500 transition-opacity duration-200 ${
            data.activeHandleColor === "yellow" 
              ? "opacity-100" 
              : "opacity-0 group-hover:opacity-100"
          }`}
        > 
          Audio 
        </p>
      )}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="audioInput2" 
        style={{ 
          top: 100,
          opacity: hasPrompt ? 1 : 0,
          pointerEvents: hasPrompt ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.audioInput2 
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
        id="audioInput3" 
        style={{ 
          top: 130,
          opacity: hasImageUrl ? 1 : 0,
          pointerEvents: hasImageUrl ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.audioInput3 
            ? '!bg-green-500 !border-white shadow-[0_0_20px_rgba(34,197,94,1)]' 
            : '!bg-black !border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(34,197,94,1)]
        `}
        data-type="green" 
      />
      {hasImageUrl && (
        <p 
          className={`absolute -left-10 top-[130px] text-xs text-green-500 transition-opacity duration-200 ${
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
        id="audioInput4"
        style={{ 
          top: 160,
          opacity: hasVideoUrl ? 1 : 0,
          pointerEvents: hasVideoUrl ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.audioInput4 
            ? '!bg-orange-500 !border-white shadow-[0_0_20px_rgba(255,140,0,1)]' 
            : '!bg-black !border-orange-500 shadow-[0_0_20px_rgba(255,140,0,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(255,140,0,1)]
        `}
        data-type="orange"
      />
      {hasVideoUrl && (
        <p 
          className={`absolute -left-10 top-[160px] text-xs text-orange-500 transition-opacity duration-200 ${
            data.activeHandleColor === "orange"
              ? "opacity-100" 
              : "opacity-0 group-hover:opacity-100"
          }`}
        > 
          Video
        </p>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="audioOutput" 
        style={{ 
          top: 100,
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !right-[-7px]
          ${connectedOutputs.audioOutput 
            ? '!bg-yellow-500 !border-white shadow-[0_0_20px_rgba(255,215,0,1)]' 
            : '!bg-black !border-yellow-500 shadow-[0_0_20px_rgba(255,215,0,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(255,215,0,1)]
        `}
        data-type="yellow"
      />
      <p 
        className={`absolute -right-10 top-[100px] text-xs text-yellow-500 transition-opacity duration-200 ${
          data.activeHandleColor === "yellow" 
            ? "opacity-100" 
            : "opacity-0 group-hover:opacity-100"
        }`}
      > 
        Audio 
      </p>
    </div>
  );
};

export default AudioGeneration;