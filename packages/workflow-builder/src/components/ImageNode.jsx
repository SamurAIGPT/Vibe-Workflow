import React, { useEffect, useMemo, useState } from "react";
import { Handle, Position, useReactFlow, useStore, useUpdateNodeInternals } from "reactflow";
import { BsArrowUpCircleFill } from "react-icons/bs";
import { downloadFile, imageModels } from "./utility";
import { getRunId, getWorkflowId } from "./WorkflowStore";
import axios from "axios";
import { toast } from "react-toastify";
import { IoClose, IoImageOutline } from "react-icons/io5";
import UploadNode from "./UploadNode";
import { SlOptions } from "react-icons/sl";
import { MdOutlineFileDownload } from "react-icons/md";
import { HiOutlineViewGrid } from "react-icons/hi";

const aspectRatios = [
  { name: "Landscape", ratio: "16:9", resolution: "1024 576", width: 1024, height: 576, w: 16, h: 9, r: 16/9 },
  { name: "Portrait", ratio: "9:16", resolution: "576 1024", width: 576, height: 1024, w: 9, h: 16, r: 9/16 },
  { name: "Square", ratio: "1:1", resolution: "1024 1024", width: 1024, height: 1024, w: 16, h: 16, r: 1/1 },
  { name: "Landscape", ratio: "4:3", resolution: "1024 768", width: 1024, height: 768, w: 16, h: 12, r: 4/3 },
  { name: "Portrait", ratio: "3:4", resolution: "768 1024", width: 768, height: 1024, w: 12, h: 16, r: 3/4 },
  { name: "Landscape", ratio: "21:9", resolution: "1024 439", width: 1024, height: 439, w: 18, h: 9, r: 21/9 },
  { name: "Portrait", ratio: "9:21", resolution: "439 1024", width: 439, height: 1024, w: 9, h: 18, r: 9/21 },
  { name: "Landscape", ratio: "5:4", resolution: "1024 819", width: 1024, height: 819, w: 16, h: 12, r: 5/4 },
  { name: "Portrait", ratio: "4:5", resolution: "819 1024", width: 819, height: 1024, w: 12, h: 16, r: 4/5 },
  { name: "Landscape", ratio: "5:6", resolution: "1024 819", width: 1024, height: 819, w: 16, h: 12, r: 5/6 },
  { name: "Portrait", ratio: "6:5", resolution: "819 1024", width: 819, height: 1024, w: 12, h: 16, r: 6/5 },
  { name: "Landscape", ratio: "3:2", resolution: "1344 896", width: 1344, height: 896, w: 12, h: 8, r: 3/2 },
  { name: "Portrait", ratio: "2:3", resolution: "896 1344", width: 896, height: 1344, w: 8, h: 12, r: 2/3 },
];

const inputHandles = [
  "imageInput",
  "imageInput2",
  "imageInput3"
];

const outputHandles = [
  "imageOutput",
];

const ImageGeneration = ({ id, data, selected }) => {
  const models = useMemo(() => {
    return data.nodeSchemas?.categories?.image?.models 
      ? Object.values(data.nodeSchemas.categories.image.models) 
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
  const properties = nodeSchemas?.categories?.image?.models?.[selectedModel.id]?.input_schema?.schemas?.input_data?.properties;
  
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

  const handleChange = (key, value) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setDropDown(-1);
  };

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
    if (data?.onDataChange && data?.selectedModel?.id !== "image-passthrough") {
      data.onDataChange(id, { selectedModel, formValues, loading });
    }
  }, [selectedModel, formValues, loading]);
  
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

      const modelSchema = nodeSchemas?.categories?.image?.models[selectedModel.id]?.input_schema?.schemas?.input_data;
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
        hasPrompt && "imageInput",
        hasImageUrl && "imageInput3",
        hasImagesList && "imageInput2",
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

  const updateWorkflowThumbnail = async (thumbnail) => {
    const workflow_id = await data.handleSaveWorkFlow();
    if (!workflow_id) {
      toast.error("Workflow id not found");
      return;
    }

    if (!thumbnail) {
      toast.error("Thumbnail URL is required");
      return;
    }
    try { 
      const response = await axios.post(`/api/workflow/${workflow_id}/thumbnail`, { 
          thumbnail 
      });
      if (response.data.success) toast.success("Cover image updated successfully");
    } catch(error) {
      toast.error(error.response?.data?.detail || "Failed to save thumbnail");
      console.error(error);
    };
  };

  return (
    <div style={{ minHeight: 210 }} className={`nowheel group flex flex-col flex-1 w-80 bg-[#0c0d0f] rounded-2xl border-2 relative transition-all duration-500 ease-in-out ${selected ? "border-white": "border-gray-500"}`}>
      <h3 className="absolute -top-5 left-0 text-gray-300 text-xs">Image {id.replace(/^\D+/g, "")}</h3>
      <div className="flex items-center justify-between bg-[#151618] rounded-t-2xl border-b border-gray-800 p-2">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            className={`p-1 rounded cursor-pointer text-white bg-transparent flex`}
          >
            <IoImageOutline size={18} />
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
      {data.selectedModel?.id === "image-passthrough" ? (
        <div className="w-full h-full">
          <UploadNode id={id} data={data} formValues={formValues} setFormValues={setFormValues} selectedModel={selectedModel} loading={loading} uploadType="upload" acceptType="image" />
        </div>
      ) : (
        <div className="flex items-center flex-grow justify-center w-full h-full rounded transition-all duration-500">
          {data.isLoading ? (
            <div className="flex items-center justify-center w-full h-full overflow-hidden aspect-[1/1]">
              <div className="flex items-center justify-center text-xs skeleton w-full h-full text-white">Generating...</div>
            </div>
          ) : data.errorMsg ? (
            <div className="text-red-300 text-sm p-2">
              {data.errorMsg || "Failed Generation"}
            </div>
          ) : data.resultUrl && !data.isLoading ? (
            <div className="h-full w-full relative">
              <div 
                className="absolute top-2 right-2" 
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
                    <button
                      type="button"
                      onClick={() => updateWorkflowThumbnail(data.resultUrl)}
                      className="flex items-center gap-2 whitespace-nowrap cursor-pointer text-[10px] text-white p-1 bg-transparent hover:bg-[#494c52] rounded-xs"
                    >
                      <HiOutlineViewGrid size={14} /> Thumbnail
                    </button>
                  </div>
                )}
              </div>
              <img
                src={data.resultUrl}
                alt="Generated"
                className="w-full h-full object-contain rounded-b-xl"
              />
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">Generation results appeared here...</p>
          )}
        </div>
      )}
      {data.selectedModel?.id !== "image-passthrough" && (
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
        id="imageInput" 
        style={{ 
          top: 100,
          opacity: hasPrompt ? 1 : 0,
          pointerEvents: hasPrompt ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`
          !rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.imageInput 
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
        id="imageInput2" 
        style={{ 
          top: 150,
          opacity: hasImagesList ? 1 : 0,
          pointerEvents: hasImagesList ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.imageInput2 
            ? '!bg-green-500 !border-white shadow-[0_0_20px_rgba(34,197,94,1)]' 
            : '!bg-black !border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(34,197,94,1)]
        `}
        data-type="green"
      />
      {hasImagesList && (
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
        id="imageInput3" 
        style={{ 
          top: 200,
          opacity: hasImageUrl ? 1 : 0,
          pointerEvents: hasImageUrl ? 'auto' : 'none',
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !left-[-7px]
          ${connectedInputs.imageInput3 
            ? '!bg-green-500 !border-white shadow-[0_0_20px_rgba(34,197,94,1)]' 
            : '!bg-black !border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(34,197,94,1)]
        `}
        data-type="green"
      />
      {hasImageUrl && (
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
        id="imageOutput" 
        style={{ 
          top: 100,
          width: 12,
          height: 12,
          transition: 'all 0.2s ease-in-out',
        }} 
        className={`!rounded-full !border-2 transition-all duration-200 !right-[-7px]
          ${connectedOutputs.imageOutput 
            ? '!bg-green-500 !border-white shadow-[0_0_20px_rgba(34,197,94,1)]' 
            : '!bg-black !border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
          }
          hover:!scale-125 hover:shadow-[0_0_20px_rgba(34,197,94,1)]
        `}
        data-type="green"
      />
      <p 
        className={`absolute -right-10 top-[100px] text-xs text-green-500 transition-opacity duration-200 ${
          data.activeHandleColor === "green"
            ? "opacity-100" 
            : "opacity-0 group-hover:opacity-100"
        }`}
      > 
        Image 
      </p>
    </div>
  );
};

export default ImageGeneration;
