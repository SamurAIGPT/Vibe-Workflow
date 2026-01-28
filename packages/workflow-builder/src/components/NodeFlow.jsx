"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "reactflow";
// import "reactflow/dist/style.css";
import { BsArrowUpCircleFill } from "react-icons/bs";
import { FiZoomIn, FiZoomOut } from "react-icons/fi";
import { TfiText } from "react-icons/tfi";
import { MdLockOutline, MdOutlineZoomOutMap, MdSave } from "react-icons/md";
import { LuLayoutTemplate, LuMousePointer2 } from "react-icons/lu";
import { FaAngleDown, FaAngleLeft, FaCheck, FaPlay, FaPlus, FaRegHand, FaToolbox, FaUpload } from "react-icons/fa6";
import { FaRegEdit, FaTelegramPlane } from "react-icons/fa";
import { IoDuplicateOutline, IoImageOutline, IoVideocamOutline } from "react-icons/io5";
import { ToastContainer, toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import TextGeneration from "./TextNode";
import ImageGeneration from "./ImageNode";
import VideoGeneration from "./VideoNode";
import { setWorkflowIds } from "./WorkflowStore";
import { apiNodeModels, audioModels, concatModels, imageModels, textModels, videoModels, presets } from "./utility";
import Link from "next/link";
import RenderField from "./RenderField";
import PromptConcate from "./PromptConcate";
import { TbArrowMerge } from "react-icons/tb";
import { RiInputMethodLine } from "react-icons/ri";
import ApiNode from "./ApiNode";
import RenderApiField from "./RenderApiField";
import AudioGeneration from "./AudioNode";
import NodesNavbar from "./NodesNavbar"
import ChatWidget from "./ChatWidget";
import { AiOutlineAudio } from "react-icons/ai";

const nodeTypes = {
  textNode: TextGeneration,
  imageNode: ImageGeneration,
  videoNode: VideoGeneration,
  audioNode: AudioGeneration,
  concatNode: PromptConcate,
  apiNode: ApiNode
}

const initialNodes = [
  { id: "text1", position: { x: 0, y: 100 }, data: {}, type: "textNode" },
  { id: "image1", position: { x: 300, y: 100 }, data: {}, type: "imageNode" },
];

const initialEdges = [];

const edgeStyles = {
  blue: {
    stroke: '#3b82f6', // blue-500
    strokeWidth: 2,
    // animated: true,
  },
  green: {
    stroke: '#22c55e', // green-500
    strokeWidth: 2,
    // animated: true,
  },
  orange: {
    stroke: '#f97316', // orange-500
    strokeWidth: 2,
    // animated: true,
  },
  gray: {
    stroke: '#6b7280', // gray-500
    strokeWidth: 2,
  },
  yellow: {
    stroke: '#eab308', // yellow-500
    strokeWidth: 2,
  },
  white: {
    stroke: '#ffffff',
    strokeWidth: 2,
  }
};

const getEdgeColor = (sourceHandle, targetHandle, sourceNode = null, targetNode = null) => {
  if (sourceHandle === "apiOutput" && sourceNode) {
    const output = sourceNode.data.outputs?.[0];
    const modelType = sourceNode.data.formValues?.model_type;
    
    if (output?.type === 'text' || modelType === 'chat') return "blue";
    if (output?.type === 'video_url' || modelType === 'video') return "orange";
    if (output?.type === 'audio_url' || modelType === 'audio') return "yellow";
    return "green";
  }

  if (["textOutput", "concatOutput"].includes(sourceHandle)) return "blue";
  if (["imageOutput"].includes(sourceHandle)) return "green";
  if (["videoOutput"].includes(sourceHandle)) return "orange";
  if (["audioOutput"].includes(sourceHandle)) return "yellow";

  if (["textInput", "imageInput", "videoInput", "audioInput2", "concatInput", "apiInput"].includes(targetHandle)) return "blue";
  if (["textInput2", "textInput3", "imageInput2", "imageInput3", "videoInput2", "videoInput3", "videoInput6", "audioInput3", "apiInput2", "apiInput3"].includes(targetHandle)) return "green";
  if (["videoInput4", "audioInput4"].includes(targetHandle)) return "orange";
  if (["audioInput", "videoInput5"].includes(targetHandle)) return "yellow";

  if (sourceNode) {
    const type = sourceNode.type;
    if (type === 'textNode' || type === 'concatNode') return "blue";
    if (type === 'imageNode') return "green";
    if (type === 'videoNode') return "orange";
    if (type === 'audioNode') return "yellow";
  }

  return "white";
};

const NodeFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeHandleColor, setActiveHandleColor] = useState(null);
  const [loadingNodes, setLoadingNodes] = useState({});
  const [isRunning, setIsRunning] = useState(0);
  const [dropDown, setDropDown] = useState(0);
  const [workflowName, setWorkflowName] = useState("Untitled");
  const [workflowId, setWorkflowId] = useState(null);
  const [runId, setRunId] = useState(null);
  const [hasFit, setHasFit] = useState(false);
  const [nodeSchemas, setNodeSchemas] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggedEdgeInfo, setDraggedEdgeInfo] = useState(null);
  const [edgePicker, setEdgePicker] = useState(null);
  const connectionMadeRef = useRef(false);
  const onConnectRef = useRef(null);
  const [interactionMode, setInteractionMode] = useState(false);
  const [publishWorkflow, setPublishWorkflow] = useState(false);
  const [template, setTemplate] = useState({
    showTemplateBtn: false,
    isPublishedTemplate: false
  });
  const [isDragging, setIsDragging] = useState(true);
  const [modelSearch, setModelSearch] = useState("");
  const [isPresetsDismissed, setIsPresetsDismissed] = useState(true);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const { zoomIn, zoomOut, fitView, getNodes, screenToFlowPosition } = useReactFlow();
  const params = useParams();
  const { id } = params;

  const apiModelsFromBackend =
    nodeSchemas?.categories?.api?.models
      ? Object.keys(nodeSchemas.categories.api.models)
      : [];

  const filteredApiNodeModels = apiNodeModels.filter(model =>
    apiModelsFromBackend.includes(model.id)
  );

  const loadPreset = (preset) => {
    setIsPresetsDismissed(true);
    setNodes(preset.nodes);
    setEdges(preset.edges);
    setTimeout(() => fitView({ padding: 0.4, duration: 500 }), 100);
  };

  const iconMap = {
    "plus": <FaPlus size={20} />,
    "image": <IoImageOutline size={20} />,
    "video": <IoVideocamOutline size={20} />,
    "audio": <AiOutlineAudio size={20} />,
    "text": <TfiText size={20} />,
  };

  const formatName = (id) => id.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const SPECIAL_MODEL_NAMES = {
    "text-passthrough": "Input Text",
    "image-passthrough": "Input Image",
    "video-passthrough": "Input Video",
    "audio-passthrough": "Input Audio",
  };

  useEffect(() => {
    axios.get(`/api/workflow/${id}/node-schemas`)
    .then(res => setNodeSchemas(res.data || {}))
    .catch(err => console.error("Failed to load node schemas", err));

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (!nodeSchemas?.categories) return;
    setNodes((prev) => {
      const needsUpdate = prev.some((n) => n.data.nodeSchemas !== nodeSchemas);
      if (!needsUpdate) return prev;
      
      return prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          nodeSchemas,
        },
      }));
    });
  }, [nodeSchemas]);
  
  const getModelObj = (category, modelId) => {
    if (category === "api") return filteredApiNodeModels.find(m => m.id === modelId) || null;
    if (!modelId || !nodeSchemas?.categories) return null;
    const rawModel = nodeSchemas.categories[category]?.models?.[modelId];
    if (!rawModel) return null;
    
    return {
      ...rawModel,
      id: modelId,
      name: SPECIAL_MODEL_NAMES[modelId] || formatName(modelId)
    };
  };

  useEffect(() => {
    if (!id && nodeSchemas?.categories) return;
    // if (id === undefined) return;

    axios.get(`/api/workflow/get-workflow-def/${id}`)
    .then(res => {
      const workflow = res.data?.data;
      if (!workflow?.nodes) return;

      const restoredNodes = workflow.nodes.map(n => ({
        id: n.id,
        type: n.category === "utility" ? "concatNode": `${n.category}Node`,
        position: { 
          x: n.position?.x ?? 350, 
          y: n.position?.y ?? 0 
        },
        data: {
          nodeSchemas,
          modelId: n.model,
          selectedModel: getModelObj(n.category, n.model),
          outputs: n.output_params?.outputs || [],
          resultUrl: n.output_params?.resultUrl || null,
          formValues: n.input_params || {},
        }
      }));

      const restoredEdges = (res.data.edges || []).map((e) => {
        const sourceNode = restoredNodes.find(n => n.id === e.source);
        const targetNode = restoredNodes.find(n => n.id === e.target);
        let edgeColor = getEdgeColor(e.sourceHandle, e.targetHandle, sourceNode, targetNode);

        return {
          id: e.id || `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
          style: edgeStyles[edgeColor],
        }
      });

      setNodes(restoredNodes);
      setEdges(restoredEdges);
      setWorkflowId(id);
      setRunId(res.data?.run_id);
      setWorkflowName(res.data.name);
      setWorkflowIds(res.data.workflow_id, res.data?.run_id);
      setInteractionMode(res.data.is_owner);
      setPublishWorkflow(res.data.is_published);
      setTemplate(prev => ({
        ...prev,
        showTemplateBtn: res.data.show_temp_button,
        isPublishedTemplate: res.data.is_template,
      }));
    })
    .catch((error) => {
      console.log(error);
      setInteractionMode(false);
    })
    .finally(() => {
      setIsRestoring(false);
    });
  }, [nodeSchemas]);

  useEffect(() => {
    if (isRestoring) return;

    if (nodes.length > 0 && !hasFit) {
      const timeout = setTimeout(() => {
        fitView({ padding: 0.4, duration: 500, minZoom: 0.2 });
        setHasFit(true);
      }, 100);
      return () => clearTimeout(timeout);
    } else if (nodes.length === 0) {
      setIsPresetsDismissed(false);
    };
  }, [nodes, hasFit, fitView, isRestoring]);

  const arrangeNodesInRow = useCallback(() => {
    const spacing = 350;
    const y = 100;
    setNodes((nds) =>
      nds.map((node, index) => ({
        ...node,
        position: { x: index * spacing, y },
      }))
    );
  }, [setNodes]);

  useEffect(() => {
    if (workflowId) return;
    arrangeNodesInRow();
  }, [arrangeNodesInRow]);

  const onDataChange = (id, newData) => {
    setNodes((prevNodes) => {
      let updatedNodes = prevNodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      );

      if (newData.errorMsg && newData.errorMsg !== null) {
        updatedNodes = updatedNodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, errorMsg: newData.errorMsg } }
            : node
        );
        return updatedNodes;
      }

      const connectedEdges = edges.filter((e) => e.source === id);
      if (!connectedEdges.length) return updatedNodes;

      const resultValue = newData.resultUrl || newData.outputs?.[0]?.value;
      // if (!resultValue) return updatedNodes;

      updatedNodes = updatedNodes.map((node) => {
        const edge = connectedEdges.find((e) => e.target === node.id);
        if (!edge) return node;

        const targetHandle = edge.targetHandle;
        let updatedFormValues = { ...node.data.formValues };

        const sourceNode = updatedNodes.find((n) => n.id === edge.source);
        const sourceValue = sourceNode?.type === "concatNode" 
          ? sourceNode?.data?.formValues?.prompt 
          : resultValue;

        if (["textInput", "imageInput", "videoInput", "audioInput2", "apiInput"].includes(targetHandle)) {
          updatedFormValues.prompt = sourceValue;
        }

        else if (["textInput3", "imageInput2", "videoInput6"].includes(targetHandle)) {
          const list = Array.isArray(updatedFormValues.images_list)
            ? [...updatedFormValues.images_list]
            : [];
          if (!list.includes(resultValue)  && resultValue && resultValue.trim() !== "") list.push(resultValue);
          updatedFormValues.images_list = list;
        }

        else if (targetHandle === "apiInput2") {
          const list = Array.isArray(updatedFormValues.images)
            ? [...updatedFormValues.images]
            : [];
          if (!list.includes(resultValue) && resultValue && resultValue.trim() !== "") list.push(resultValue);
          updatedFormValues.images = list;
        }

        else if (["textInput2", "videoInput2", "imageInput3", "audioInput3"].includes(targetHandle)) {
          updatedFormValues.image_url = resultValue;
        }

        else if (targetHandle === "apiInput3") {
          updatedFormValues.image = resultValue;
        }

        else if (targetHandle === "videoInput3") {
          updatedFormValues.last_image = resultValue;
        }

        else if (["videoInput4", "audioInput4"].includes(targetHandle)) {
          updatedFormValues.video_url = resultValue;
        }

        else if (["videoInput5", "audioInput"].includes(targetHandle)) {
          updatedFormValues.audio_url = resultValue;
        }

        else if (node.type === "apiNode") {
          const listFields = ["images", "image_urls", "images_list"];
          const isList = listFields.includes(targetHandle) || node.data.taskData?.[targetHandle]?.type === "array";

          if (isList) {
            const list = Array.isArray(updatedFormValues[targetHandle])
              ? [...updatedFormValues[targetHandle]]
              : [];
            if (sourceValue && sourceValue.trim() !== "" && !list.includes(sourceValue)) {
              list.push(sourceValue);
            }
            updatedFormValues[targetHandle] = list;
          } else {
            updatedFormValues[targetHandle] = sourceValue;
          }
        }

        return {
          ...node,
          data: {
            ...node.data,
            formValues: updatedFormValues,
          },
        };
      });

      updatedNodes = updatedNodes.map((node) => {
        if (node.type !== "concatNode") return node;

        const allConcatEdges = edges.filter((e) => 
          e.target === node.id && e.targetHandle === "concatInput"
        );

        if (allConcatEdges.length === 0) {
          return {
            ...node,
            data: {
              ...node.data,
              formValues: {
                ...node.data.formValues,
                prompt: "",
              },
            },
          };
        }

        const concatValues = allConcatEdges.map((e) => {
          const sourceNode = updatedNodes.find((n) => n.id === e.source);
          return sourceNode?.data?.resultUrl || sourceNode?.data?.outputs?.[0]?.value || "";
        }).filter((v) => typeof v === "string" && v.trim() !== "");

        return {
          ...node,
          data: {
            ...node.data,
            formValues: {
              ...node.data.formValues,
              prompt: concatValues.length > 0 ? concatValues.join(" ").trim() : "",
            },
          },
        };
      });

      return updatedNodes;
    });

    if (newData.hasOwnProperty('isLoading')) {
      setLoadingNodes(prev => {
        const newLoadingNodes = { ...prev };
        if (newData.isLoading) {
          newLoadingNodes[id] = true;
        } else {
          delete newLoadingNodes[id];
        }
        return newLoadingNodes;
      });
    }
  };

  const onConnect = useCallback(
    (params) => {
      const targetNodeExists = nodes.some(n => n.id === params.target);
      if (targetNodeExists) {
        connectionMadeRef.current = true;
      }
      setEdges((eds) => {
        const sourceNode = nodes.find((n) => n.id === params.source) || {};
        const targetNode = nodes.find((n) => n.id === params.target) || {};
        let color = getEdgeColor(params.sourceHandle, params.targetHandle, sourceNode, targetNode);

        if (color === "blue" && targetNode?.type !== "concatNode" && targetNode.type !== "apiNode") {
          const hasExistingBlueConnection = eds.some(edge => {
            if (edge.target !== params.target) return false;
            
            const edgeColor = 
              ["textInput", "imageInput", "videoInput", "audioInput2", "concatInput"].includes(edge.targetHandle) ||
              ["textOutput", "concatOutput"].includes(edge.sourceHandle)
                ? "blue"
                : "other";
            
            return edgeColor === "blue";
          });

          if (hasExistingBlueConnection) {
            return eds;
          }
        }

        const newEdges = addEdge({ ...params, style: edgeStyles[color] }, eds);
        if (!sourceNode || !targetNode || !sourceNode.data) return newEdges;

        const sourceData = sourceNode.data;
        const resultValue = sourceData.outputs?.[0]?.value || sourceData.resultUrl || null;
        // if (!resultValue || resultValue.trim() === "") return newEdges;
        
        const sourceValue = sourceNode?.type === "concatNode" 
          ? sourceNode?.data?.formValues?.prompt 
          : resultValue;

        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== targetNode.id) return n;

            let updatedFormValues  = { ...n.data.formValues };

            if (n.id === params.target && n.type === "apiNode") {
              const listFields = ["images", "image_urls", "images_list"];
              const isList = listFields.includes(params.targetHandle) || n.data.taskData?.[params.targetHandle]?.type === "array";

              if (isList) {
                const list = Array.isArray(updatedFormValues[params.targetHandle]) ? [...updatedFormValues[params.targetHandle]]: [];
                if (sourceValue && sourceValue.trim() !== "" && !list.includes(sourceValue)) {
                  list.push(sourceValue);
                }
                updatedFormValues[params.targetHandle] = list;
              } else {
                updatedFormValues[params.targetHandle] = sourceValue;
              }
            }

            if (color === "blue") {
              if (targetNode.type === "concatNode" && params.targetHandle === "concatInput") {
                const allConcatEdges = newEdges.filter((e) => 
                  e.target === targetNode.id && e.targetHandle === "concatInput"
                );
                
                const concatValues = allConcatEdges.map((e) => {
                  if (e.source === params.source) return resultValue;
                  const sourceNode = prev.find((node) => node.id === e.source);
                  return sourceNode?.data?.resultUrl || sourceNode?.data?.outputs?.[0]?.value || "";
                }).filter(v => v);
                
                updatedFormValues.prompt = concatValues.join(" ");
              }

              else if (["textInput", "imageInput", "videoInput", "audioInput2", "apiInput"].includes(params.targetHandle)) {
                updatedFormValues.prompt = sourceValue;
              }
            }

            if (color === "green") {
              if (["textInput2", "videoInput2", "imageInput3", "audioInput3"].includes(params.targetHandle)) {
                updatedFormValues.image_url = resultValue;
              } else if (["textInput3", "imageInput2", "videoInput6"].includes(params.targetHandle)) {
                const list = Array.isArray(updatedFormValues.images_list) ? [...updatedFormValues.images_list]: [];
                if (!list.includes(resultValue) && resultValue && resultValue.trim() !== "") {
                  list.push(resultValue);
                }
                updatedFormValues.images_list = list;
              } else if (params.targetHandle === "apiInput2") {
                const list = Array.isArray(updatedFormValues.images) ? [...updatedFormValues.images]: [];
                if (!list.includes(resultValue) && resultValue && resultValue.trim() !== "") {
                  list.push(resultValue);
                }
                updatedFormValues.images = list;
              } else if (params.targetHandle === "videoInput3") {
                updatedFormValues.last_image = resultValue;
              } else if (params.targetHandle === "apiInput3") {
                updatedFormValues.image = resultValue;
              }
            }

            if (color === "orange") {
              if (["videoInput4", "audioInput4"].includes(params.targetHandle)) {
                updatedFormValues.video_url = resultValue
              }
            }

            if (color === "yellow") {
              if (["audioInput", "videoInput5"].includes(params.targetHandle)) {
                updatedFormValues.audio_url = resultValue !== undefined ? resultValue : null;
              }
            }

            return {
              ...n,
              data: {
                ...n.data,
                formValues: updatedFormValues,
              },
            };
          })
        );

        return newEdges;
      });
    },
    [nodes]
  );

  const pollArchitectStatus = (request_id) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/workflow/poll-architect/${request_id}/result`);
        const finalData = response.data;
        const status = finalData.status;

        if (status === "completed") {
          clearInterval(interval);
          const { message, suggestions, workflow } = finalData;
          
          const newAgentMessage = { 
            role: "agent", 
            content: message || "Tasks complete. Your workflow has been updated.",
            suggestions: suggestions || [],
            timestamp: new Date().toISOString()
          };
          setChatMessages((prev) => [...prev, newAgentMessage]);

          if (workflow && workflow.nodes) {
            const idMapping = {};
            const counts = { text: 0, image: 0, video: 0, audio: 0 };

            const newNodes = workflow.nodes.map((n) => {
              let newId = n.id;
              const category = n.category;
              
              if (["user_text", "prompt_gen"].includes(n.id) || category === "text") {
                counts.text++;
                newId = `text${counts.text}`;
              } else if (n.id === "image_gen" || category === "image") {
                counts.image++;
                newId = `image${counts.image}`;
              } else if (category === "video") {
                counts.video++;
                newId = `video${counts.video}`;
              } else if (category === "audio") {
                counts.audio++;
                newId = `audio${counts.audio}`;
              }
              
              idMapping[n.id] = newId;
              const existingNode = nodes.find((en) => en.id === newId);

              return {
                id: newId,
                type: n.category === "utility" ? "concatNode" : `${n.category}Node`,
                position: existingNode?.position || { 
                  x: n.position?.x ?? 350, 
                  y: n.position?.y ?? 0 
                },
                data: {
                  nodeSchemas,
                  modelId: n.model,
                  selectedModel: getModelObj(n.category, n.model),
                  outputs: n.output_params?.outputs || [],
                  resultUrl: n.output_params?.resultUrl || null,
                  formValues: n.input_params || n.params || {},
                }
              };
            });

            setNodes(newNodes);

            if (workflow.edges && workflow.edges.length > 0) {
              const newEdges = workflow.edges.map((e) => {
                const source = idMapping[e.source] || e.source;
                const target = idMapping[e.target] || e.target;
                
                const sourceNode = newNodes.find(n => n.id === source);
                const targetNode = newNodes.find(n => n.id === target);

                let sourceHandle = e.sourceHandle;
                let targetHandle = e.targetHandle;

                if ((!sourceHandle || sourceHandle === 'output') && sourceNode) {
                  if (sourceNode.type === 'textNode') sourceHandle = 'textOutput';
                  else if (sourceNode.type === 'imageNode') sourceHandle = 'imageOutput';
                  else if (sourceNode.type === 'videoNode') sourceHandle = 'videoOutput';
                  else if (sourceNode.type === 'audioNode') sourceHandle = 'audioOutput';
                  else if (sourceNode.type === 'concatNode') sourceHandle = 'concatOutput';
                }
                
                if ((!targetHandle || targetHandle === 'prompt') && targetNode) {
                  if (targetNode.type === 'textNode') targetHandle = 'textInput';
                  else if (targetNode.type === 'imageNode') targetHandle = 'imageInput';
                  else if (targetNode.type === 'videoNode') targetHandle = 'videoInput';
                  else if (targetNode.type === 'audioNode') targetHandle = 'audioInput2';
                  else if (targetNode.type === 'concatNode') targetHandle = 'concatInput';
                }

                let edgeColor = getEdgeColor(sourceHandle, targetHandle, sourceNode, targetNode);

                return {
                  id: `e-${source}-${target}`,
                  source,
                  target,
                  sourceHandle,
                  targetHandle,
                  style: edgeStyles[edgeColor],
                };
              });

              setEdges(newEdges);
            }
          }
          setIsChatLoading(false);
        } else if (status === "failed") {
          clearInterval(interval);
          throw new Error("Architect processing failed");
        }
      } catch (error) {
        clearInterval(interval);
        console.error("Polling error:", error);
        const errorMessage = {
          role: "agent",
          content: "Sorry, I encountered an error while updating your workflow.",
          timestamp: new Date().toISOString()
        };
        setChatMessages((prev) => [...prev, errorMessage]);
        setIsChatLoading(false);
      }
    }, 3000);
  };

  const handleSendMessage = async (content) => {
    const newMessage = { 
      role: "user", 
      content,
      timestamp: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, newMessage]);
    
    setIsChatLoading(true);
    try {
      const savedWorkflowId = await handleSaveWorkFlow();
      
      const history = chatMessages.map(msg => ({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content
      }));

      const response = await axios.post("/api/workflow/architect", {
        prompt: content,
        workflow_id: savedWorkflowId,
        history: history,
      });
      
      const { request_id, status } = response.data;
      pollArchitectStatus(request_id);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        role: "agent",
        content: "Sorry, I encountered an error processing your request.",
        timestamp: new Date().toISOString()
      };
      setChatMessages((prev) => [...prev, errorMessage]);
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  const onEdgeClick = (event, edge) => {
    event.stopPropagation();
    setEdges((eds) => {
      const updatedEdges = eds.filter((e) => e.id !== edge.id);
      
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (targetNode?.type === "concatNode" && edge.targetHandle === "concatInput") {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== targetNode.id) return n;
            const remainingConcatEdges = updatedEdges.filter((e) => 
              e.target === targetNode.id && e.targetHandle === "concatInput"
            );

            let updatedFormValues = { ...n.data.formValues };

            if (remainingConcatEdges.length > 0) {
              const concatValues = remainingConcatEdges.map((e) => {
                const sourceNode = prev.find((node) => node.id === e.source);
                return sourceNode?.data?.resultUrl || sourceNode?.data?.outputs?.[0]?.value || "";
              }).filter(v => v);
              
              updatedFormValues.prompt = concatValues.join(" ");
            } else {
              updatedFormValues.prompt = "";
            }

            return {
              ...n,
              data: {
                ...n.data,
                formValues: updatedFormValues,
              },
            };
          })
        );
      }
      return updatedEdges;
    });
  };

  const buildWorkflowPayload = () => {
    const nodeData = nodes.map((node) => {

      const connectedEdges = edges.filter((e) => e.target === node.id);
      const inputNodes = connectedEdges.map((e) => e.source);
      const category = node.type === "textNode" ? "text": node.type === "imageNode" ? "image": node.type === "videoNode" ? "video": node.type === "apiNode" ? "api": node.type === "audioNode" ? "audio": "utility";
      const model = node.data?.selectedModel?.id ? node.data?.selectedModel?.id : category === "utility" ? "prompt-concatenator": `${category}-passthrough`;
      const modelSchema = nodeSchemas?.categories?.[category]?.models?.[model]?.input_schema?.schemas?.input_data;
      const inputSchema = modelSchema?.properties || {};
      const wavespeedSchema = nodeSchemas?.categories?.api?.models?.[model]?.input_schema;
      const concatSchema = nodeSchemas?.categories?.utility?.models?.["prompt-concatenator"]?.input_schema;
      
      let dynamicPrompt = "";

      if (node.type === "concatNode") {
        const promptConnections = connectedEdges.filter((e) =>
          ["concatInput"].includes(e.targetHandle)
        );
        dynamicPrompt = promptConnections.length > 0
          ? promptConnections.map((conn) => `{{ ${conn.source}.outputs[0].value }}`)
          : [];
      } else {
        const promptConnections = connectedEdges.filter((e) =>
          ["textInput", "imageInput", "videoInput", "audioInput2", "apiInput"].includes(e.targetHandle)
        );
        dynamicPrompt = promptConnections.length > 0
          ? `{{ ${promptConnections[0].source}.outputs[0].value }}`
          : "";
      }

      const imageListConnections = connectedEdges.filter((e) =>
        ["textInput3", "imageInput2", "videoInput6", "apiInput2"].includes(e.targetHandle)
      );

      const dynamicImagesList =
        imageListConnections.length > 0
          ? imageListConnections.map(
              (conn) => `{{ ${conn.source}.outputs[0].value }}`
            )
          : node.data?.formValues?.images_list || []; // || [node.data?.outputs?.[0]?.value] 

      const imageUrlConnections = connectedEdges.filter((e) =>
        ["textInput2", "videoInput2", "imageInput3", "audioInput3", "apiInput3"].includes(e.targetHandle)
      );

      const videoUrlConnections = connectedEdges.filter((e) => 
        ["videoInput4", "audioInput4"].includes(e.targetHandle)
      );

      const audioUrlConnections = connectedEdges.filter((e) => 
        ["audioInput", "videoInput5"].includes(e.targetHandle)
      );

      const dynamicImageUrl =
        imageUrlConnections.length > 0
          ? `{{ ${imageUrlConnections[0].source}.outputs[0].value }}`
          : node.data?.formValues?.image_url || null;

      const lastImageConnections = connectedEdges.filter(
        (e) => e.targetHandle === "videoInput3"
      );

      const dynamicVideoUrl = 
        videoUrlConnections.length > 0
          ? `{{ ${videoUrlConnections[0].source}.outputs[0].value }}`
          : node.data?.formValues?.video_url || null;

      const dynamicAudioUrl = 
        audioUrlConnections.length > 0
          ? `{{ ${audioUrlConnections[0].source}.outputs[0].value }}`
          : node.data?.formValues?.audio_url || null;

      const dynamicLastImage =
        lastImageConnections.length > 0
          ? `{{ ${lastImageConnections[0].source}.outputs[0].value }}`
          : node.data?.formValues?.last_image || null; // || node.data?.outputs?.[0]?.value 

      const localSources = {
        ...node.data?.formValues,
        prompt: dynamicPrompt ? dynamicPrompt: node.data?.formValues?.prompt,
        images_list: dynamicImagesList,
        images: dynamicImagesList,
        image_urls: dynamicImagesList,
        image_url: dynamicImageUrl,
        video_url: dynamicVideoUrl,
        audio_url: dynamicAudioUrl,
        image: dynamicImageUrl,
        last_image: dynamicLastImage,
      };

      if (node.type === "apiNode") {
        const listFields = ["images", "image_urls", "images_list"];
        connectedEdges.forEach((edge) => {
          if (edge.target === node.id) {
            const val = `{{ ${edge.source}.outputs[0].value }}`;
            const isList = listFields.includes(edge.targetHandle) || wavespeedSchema?.[edge.targetHandle]?.type === "array";
            
            if (isList) {
              if (!Array.isArray(localSources[edge.targetHandle])) {
                localSources[edge.targetHandle] = [];
              }
              if (!localSources[edge.targetHandle].includes(val)) {
                localSources[edge.targetHandle].push(val);
              }
            } else {
              localSources[edge.targetHandle] = val;
            }
          }
        });
      }

      let params = {};
      const input_params = node.data?.formValues || {};
      let output_params = {};

      if (node.type === "apiNode") {
        for (const [key, meta] of Object.entries(wavespeedSchema)) {
          if (localSources[key] !== undefined && localSources[key] !== null) {
            params[key] = localSources[key];
          } else {
            params[key] = meta.default ?? null;
          }
        }

        const filteredInputParams = Object.fromEntries(
          Object.entries(input_params).filter(([key]) =>
            key !== "model_url" && key !== "api_key" && key !== "model_name" && key !== "model_type"
          )
        );
        
        params["params"] = filteredInputParams;

        for (const [key, meta] of Object.entries(filteredInputParams)) {
          if (localSources[key] !== undefined && localSources[key] !== null) {
            params.params[key] = localSources[key];
          } else {
            params.params[key] = meta?.default ?? null;
          }
        }
      } else if (node.type === "concatNode") {
        for (const [key, meta] of Object.entries(concatSchema)) {
          if (localSources[key] !== undefined && localSources[key] !== null) {
            params[key] = localSources[key];
          } else {
            params[key] = meta.default ?? null;
          }
        }
      } else {
        for (const [key, meta] of Object.entries(inputSchema)) {
          if (localSources[key] !== undefined && localSources[key] !== null) {
            params[key] = localSources[key];
          } else {
            params[key] = meta.default ?? null;
          }
        }
      }

      if (node.type === "textNode") {
        output_params = {
          resultUrl: node.data?.resultUrl || "",
          outputs: node.data?.outputs || [],
        }
      } else if (["imageNode", "videoNode", "audioNode", "apiNode", "concatNode"].includes(node.type)) {
        output_params = {
          resultUrl: node.data?.resultUrl || null,
          outputs: node.data?.outputs || [],
        }
      }

      return {
        id: node.id,
        category,
        model,
        input_params,
        output_params,
        params,
        position: node.position,
        ...(inputNodes.length > 0 ? { inputs: inputNodes } : {}),
      };
    });

    return { 
      workflow_id: interactionMode ? workflowId || null: null,
      name: workflowName || "Untitled",
      edges: edges,
      data: { 
        nodes: nodeData 
      },
      is_vadoo: false,
    };
  }; 

  const handleSaveWorkFlow = async () => {
    if (!interactionMode) return;
    const workflowPayload = buildWorkflowPayload();

    try {
      const response = await axios.post("/api/workflow/create", workflowPayload);
      console.log("Workflow created:", response.data);
      setDropDown(0);
      setWorkflowIds(response.data.workflow_id, runId);
      setWorkflowId(response.data.workflow_id);
      return response.data.workflow_id;
    } catch (error) {
      console.log(error);
      if (error.response) {
        toast.error(`Failed: ${error.response.data.detail || "Server error"}`);
      } else {
        toast.error(`Error: ${error.message}`);
      }
    }
  };

  const handleDuplicateWorkflow = async () => {
    if (interactionMode) return;
    setIsRunning(3);
    const workflowPayload = buildWorkflowPayload();

    try {
      const response = await axios.post("/api/workflow/create", workflowPayload);
      console.log("Workflow created:", response.data);
      window.location.href = `/workflow/${response.data.workflow_id}`;
    } catch(error) {
      console.log(error);
      setIsRunning(0);
      if (error.response) {
        toast.error(`Failed: ${error.response.data.detail || "Server error"}`);
      } else {
        toast.error(`Error: ${error.message}`);
      }
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      handleSaveWorkFlow(); 
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleSaveWorkFlow]);

  const pollRunIdStatus = (runId) => {
    const interval = setInterval(() => {
      axios.get(`/api/workflow/run/${runId}/status`)
      .then((response) => {
        const runData = response.data;
        const nodesStatus = runData?.nodes || {};
        setWorkflowIds(workflowId, runId);

        Object.entries(nodesStatus).forEach(([id, runs]) => {
          const status = runs[0]?.status;
          const result = runs[0]?.result;
          const outputs = result?.outputs || [];
          const first = outputs?.[0]?.value || "";

          if (status === "processing") {
            setLoadingNodes((prev) => ({ ...prev, [id]: true }));
            return;
          } else {
            setLoadingNodes((prev) => {
              const copy = { ...prev };
              delete copy[id];
              return copy;
            });
          }

          if (status === "succeeded") {
            setLoadingNodes((prev) => {
              const copy = { ...prev };
              delete copy[id];
              return copy;
            });

            setNodes((prevNodes) => {
              let updatedNodes = prevNodes.map((node) => {
                if (node.id !== id || !result) return node;

                if (["textNode", "imageNode", "videoNode", "audioNode", "concatNode", "apiNode"].includes(node.type)) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      outputs,
                      resultUrl: first,
                      isLoading: false,
                      errorMsg: null,
                    },
                  };
                }

                return node;
              });

              const sourceNode = prevNodes.find((n) => n.id === id);
              const sourceType = sourceNode?.type || "";

              const connectedTargets = edges
                .filter((e) => e.source === id)
                .map((e) => e.target);

              updatedNodes = updatedNodes.map((node) => {
                if (!connectedTargets.includes(node.id)) return node;

                const updatedFormValues = { ...node.data.formValues };

                if (sourceType === "textNode" || sourceType === "concatNode") {
                  updatedFormValues.input_node_prompt = first;
                }

                if (node.type === "concatNode") {
                  const allConcatEdges = edges.filter((e) => 
                    e.target === node.id && e.targetHandle === "concatInput"
                  );
                  
                  if (allConcatEdges.length > 0) {
                    const concatValues = allConcatEdges.map((e) => {
                      if (e.source === sourceNode.id) return first;
                      const sourceNodeForConcat = updatedNodes.find((n) => n.id === e.source);
                      return sourceNodeForConcat?.data?.resultUrl || sourceNodeForConcat?.data?.outputs?.[0]?.value || "";
                    }).filter(v => v);
                    
                    updatedFormValues.prompt = concatValues.join(" ");
                  }
                }

                if (["imageNode", "videoNode", "audioNode", "apiNode"].includes(sourceType)) {
                  const imageKey = Object.keys(updatedFormValues).find((k) =>
                    ["image_url", "images_list", "last_image", "audio_url", "images", "image"].includes(k)
                  );

                  if (imageKey) {
                    const currentValue = updatedFormValues[imageKey];
                    if (Array.isArray(currentValue)) {
                      if (!currentValue.includes(first)) {
                        updatedFormValues[imageKey] = [
                          ...currentValue,
                          first,
                        ];
                      }
                    } else {
                      updatedFormValues[imageKey] = first;
                    }
                  }
                }

                return {
                  ...node,
                  data: {
                    ...node.data,
                    formValues: updatedFormValues,
                  },
                };
              });

              return updatedNodes;
            });
          }

          if (status === "failed") {
            let errorMsg = "Generation Failed";
            if (
              result?.outputs &&
              result.outputs[0]?.value &&
              typeof result.outputs[0].value === "object" &&
              result.outputs[0].value.error
            ) {
              errorMsg = result.outputs[0].value.error;
            }

            toast.error(`Node ${id} failed: ${errorMsg}`);
            setNodes((prev) =>
              prev.map((node) =>
                node.id === id
                  ? { ...node, data: { ...node.data, isLoading: false, errorMsg: errorMsg, } }
                  : node
              )
            );
          }
        });

  
        const allCompleted = Object.values(nodesStatus).every(
          (nodeRuns) => nodeRuns[0]?.status === "succeeded"
        );

        const anyFailed = Object.values(nodesStatus).some(
          (nodeRuns) => nodeRuns[0]?.status === "failed"
        );
        if (allCompleted) {
          clearInterval(interval);
          setLoadingNodes({});
          setIsRunning(0);
        } else if (anyFailed) {
          toast.error("Workflow failed on some nodes");
          clearInterval(interval);
          setLoadingNodes({});
          setIsRunning(0);
        }
        console.log("run", runData);
      })
      .catch((error) => {
        console.log(error);
        clearInterval(interval);
        setLoadingNodes({});
        setIsRunning(0);
        toast.error("Failed to get workflow status");
      });
    }, 3000);
  };

  const handleRunWorkflow = async () => {
    if (!interactionMode) return;
    try {
      setIsRunning(1);
      setLoadingNodes({});
      const savedWorkflowId = await handleSaveWorkFlow();

      const response = await axios.post(`/api/workflow/${workflowId}/run`, {});
      console.log("run data:", response.data);
      pollRunIdStatus(response.data.run_id);
    } catch(error) {
      console.log(error);
      if (error.response) {
        toast.error(`Failed: ${error.response.data.detail || "Server error"}`);
      } else {
        toast.error(`Error: ${error.message}`);
      }
      setLoadingNodes({});
      setIsRunning(0);
    }
  };

  const handlePublishWorkflow = async () => {
    if (!interactionMode) return;
    try {
      setIsRunning(2);
      const savedWorkflowId = await handleSaveWorkFlow();
      
      const response = await axios.post(`/api/workflow/workflow/${savedWorkflowId}/publish`, {
        publish: !publishWorkflow
      });
      setIsRunning(0);
      toast.success(response.data.publish ? "Published successfully" : "Unpublished successfully");
      setPublishWorkflow(response.data.publish);
    } catch(error) {
      console.log(error);
      if (error.response) {
        toast.error(`Failed: ${error.response.data.detail || "Server error"}`);
      } else {
        toast.error(`Error: ${error.message}`);
      }
      setLoadingNodes({});
      setIsRunning(0);
    }
  };

  const handleTemplatePublish = async () => {
    if (!interactionMode) return;
    try {
      setIsRunning(4);
      const savedWorkflowId = await handleSaveWorkFlow();
      
      const response = await axios.post(`/api/workflow/workflow/${savedWorkflowId}/template`, {
        is_template: !template.isPublishedTemplate
      });
      const is_template = response.data.is_template;
      setIsRunning(0);
      toast.success(is_template ? "Published successfully" : "Unpublished successfully");
      setTemplate(prev => ({ ...prev, isPublishedTemplate: is_template }));
    } catch(error) {
      console.log(error);
      if (error.response) {
        toast.error(`Failed: ${error.response.data.detail || "Server error"}`);
      } else {
        toast.error(`Error: ${error.message}`);
      }
      setIsRunning(0);
    }
  };

  const runNodeFromFlow = (nodeId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, triggerRun: true } }
          : n
      )
    );
  };

  const runNodeInputsFromFlow = (nodeId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, triggerInputs: true } }
          : n
      )
    );
  };

  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: { 
      ...node.data,
      nodeSchemas,
      onDataChange,
      handleSaveWorkFlow,
      isLoading: loadingNodes[node.id] || false,
      activeHandleColor,
      triggerRun: node.data.triggerRun || false,
      triggerInputs: node.data.triggerInputs || false,
      runNodeFromFlow,
      runNodeInputsFromFlow,
      handleTypes: {
        ...(node.type === 'apiNode' ? Object.keys(node.data?.formValues || {}).reduce((acc, key) => ({...acc, [key]: 'white'}), {}) : {}),
        concatInput: "blue", concatOutput: "blue",
        apiInput: "blue", apiInput2: "green", apiInput3: "green",
        apiOutput: (() => {
          if (node.type !== 'apiNode') return "green";
          const output = node.data?.outputs?.[0];
          const modelType = node.data?.formValues?.model_type;
          if (output?.type === 'text' || modelType === 'chat') return "blue";
          if (output?.type === 'video_url' || modelType === 'video') return "orange";
          if (output?.type === 'audio_url' || modelType === 'audio') return "yellow";
          return "green";
        })(),
        textInput: "blue", textInput2: "green", textInput3: "green", textOutput: "blue",
        imageInput: "blue", imageInput2: "green", imageInput3: "green", imageOutput: "green",
        videoInput: "blue", videoInput2: "green", videoInput3: "green", videoInput4: "orange", videoInput5: "yellow", videoInput6: "green", videoOutput: "orange",
        audioInput: "yellow", audioInput2: "blue", audioInput3: "green", audioInput4: "orange", audioOutput: "yellow",
      }
    },
  }));

  const isValidConnection = (connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (source === target) return false;

    const sourceNode = nodesWithHandlers.find(n => n.id === source);
    const targetNode = nodesWithHandlers.find(n => n.id === target);

    if (!sourceNode || !targetNode) return false;

    const sourceType = sourceNode?.data?.handleTypes?.[sourceHandle];
    const targetType = targetNode?.data?.handleTypes?.[targetHandle];

    if (!sourceType || !targetType || (sourceType !== targetType && targetType !== 'white')) return false;

    const isSourceOutput = sourceHandle.toLowerCase().includes("output");
    const isTargetInput = targetHandle.toLowerCase().includes("input") || (targetNode.type === "apiNode" && targetHandle !== "apiOutput");
    if (!isSourceOutput || !isTargetInput) return false;

    const formValues = targetNode.data?.formValues || {};
    let validHandles = [];

    switch (targetNode.type) {
      case "textNode":
        const hasTextPrompt = "prompt" in formValues
        const hasTextImageUrl = "image_url" in formValues;
        const hasTextImagesList = "images_list" in formValues;
        validHandles = [
          hasTextPrompt && "textInput",
          hasTextImageUrl && "textInput2",
          hasTextImagesList && "textInput3",
        ].filter(Boolean);
        break;

      case "imageNode":
        const hasImagePrompt = "prompt" in formValues;
        const hasImagesList = "images_list" in formValues;
        const hasImageImageUrl = "image_url" in formValues;
        validHandles = [
          hasImagePrompt && "imageInput",
          hasImagesList && "imageInput2",
          hasImageImageUrl && "imageInput3",
        ].filter(Boolean);
        break;

      case "videoNode":
        const hasVideoPrompt = "prompt" in formValues;
        const hasVideoImagesList = "images_list" in formValues;
        const hasVideoImageUrl = "image_url" in formValues;
        const hasLastImage = "last_image" in formValues;
        const hasVideoUrl = "video_url" in formValues;
        const hasVideoAudioUrl = "audio_url" in formValues;
        validHandles = [
          hasVideoPrompt && "videoInput",
          hasVideoImageUrl && "videoInput2",
          hasLastImage && "videoInput3",
          hasVideoUrl && "videoInput4",
          hasVideoAudioUrl && "videoInput5",
          hasVideoImagesList && "videoInput6",
        ].filter(Boolean);
        break;

      case "audioNode":
        const hasAudioUrl = "audio_url" in formValues;
        const hasAudioPrompt = "prompt" in formValues;
        const hasAudioImageUrl = "image_url" in formValues;
        const hasAudioVideoUrl = "video_url" in formValues;
        validHandles = [
          hasAudioUrl && "audioInput",
          hasAudioPrompt && "audioInput2",
          hasAudioImageUrl && "audioInput3",
          hasAudioVideoUrl && "audioInput4",
        ].filter(Boolean);
        break;

      case "apiNode":
        const apiInputs = Object.keys(targetNode.data?.formValues || {});
        const exposedHandles = targetNode.data?.exposedHandles || [];
        validHandles = apiInputs.filter(k => k !== 'apiOutput' && exposedHandles.includes(k));
        break;

      default:
        return true;
    }

    if (!validHandles.includes(targetHandle)) {
      return false;
    }

    return true;
  };

  const onConnectStart = (event, params) => {
    const node = nodesWithHandlers.find(n => n.id === params.nodeId);
    const handleColor = node?.data?.handleTypes?.[params.handleId];
    setActiveHandleColor(handleColor);

    const isOutput = params.handleId.toLowerCase().includes("output");
    setDraggedEdgeInfo({
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleColor: handleColor,
      isOutput: isOutput,
    });
  };

  const onConnectEnd = useCallback((event) => {
    setActiveHandleColor(null);

    if (draggedEdgeInfo && !connectionMadeRef.current) {
      const cursorX = event?.clientX || mousePos.x;
      const cursorY = event?.clientY || mousePos.y;
      
      setEdgePicker({
        sourceNodeId: draggedEdgeInfo.isOutput ? draggedEdgeInfo.nodeId : null,
        targetNodeId: draggedEdgeInfo.isOutput ? null : draggedEdgeInfo.nodeId,
        sourceHandleId: draggedEdgeInfo.isOutput ? draggedEdgeInfo.handleId : null,
        targetHandleId: draggedEdgeInfo.isOutput ? null : draggedEdgeInfo.handleId,
        handleColor: draggedEdgeInfo.handleColor,
        isOutput: draggedEdgeInfo.isOutput,
        cursorPos: { x: cursorX, y: cursorY }
      });
    }
    
    setDraggedEdgeInfo(null);
    connectionMadeRef.current = false;
  }, [draggedEdgeInfo, nodesWithHandlers, mousePos]);

  const handleSelectNodeFromEdgePicker = (nodeType, position = null, initialData = {}) => {
    if (!edgePicker) return;
    const newNodeId = getNextId(nodeType);

    const handleTypesMap = {
      concatInput: "blue", concatOutput: "blue",
      apiInput: "blue", apiInput2: "green", apiInput3: "green", apiOutput: "green",
      textInput: "blue", textInput2: "green", textInput3: "green", textOutput: "blue",
      imageInput: "blue", imageInput2: "green", imageInput3: "green", imageOutput: "green",
      videoInput: "blue", videoInput2: "green", videoInput3: "green", videoInput4: "orange", videoInput5: "yellow", videoInput6: "green", videoOutput: "orange",
      audioInput: "yellow", audioInput2: "blue", audioInput3: "green", audioInput4: "orange", audioOutput: "yellow",
    };
    
    const flowPosition = screenToFlowPosition({
      x: edgePicker.cursorPos.x,
      y: edgePicker.cursorPos.y,
    });
    
    const newNode = {
      id: newNodeId,
      type: nodeType,
      position: {
        x: flowPosition.x - 160,
        y: flowPosition.y - 100,
      },
      data: { ...initialData },
    };
    
    setNodes((prev) => [...prev, newNode]);
    let connection;
    
    if (edgePicker.isOutput) {
      const nodeTypeToHandles = {
        textNode: ["textInput", "textInput2", "textInput3"],
        imageNode: ["imageInput", "imageInput2", "imageInput3"],
        videoNode: ["videoInput", "videoInput2", "videoInput3", "videoInput4", "videoInput5", "videoInput6"],
        audioNode: ["audioInput", "audioInput2", "audioInput3", "audioInput4"],
        apiNode: ["apiInput", "apiInput2", "apiInput3"],
        concatNode: ["concatInput"]
      };
      
      const sourceHandleColor = handleTypesMap[edgePicker.sourceHandleId];
      const compatibleHandles = nodeTypeToHandles[nodeType] || [];
      const targetHandle = compatibleHandles.find(h => 
        handleTypesMap[h] === sourceHandleColor
      );
      
      if (targetHandle) {
        connection = {
          source: edgePicker.sourceNodeId,
          target: newNodeId,
          sourceHandle: edgePicker.sourceHandleId,
          targetHandle: targetHandle,
        };
      }
    } else {
      const nodeTypeToHandles = {
        textNode: ["textOutput"],
        imageNode: ["imageOutput"],
        videoNode: ["videoOutput"],
        audioNode: ["audioOutput"],
        apiNode: ["apiOutput"],
        concatNode: ["concatOutput"]
      };
      
      const targetHandleColor = handleTypesMap[edgePicker.targetHandleId];
      const compatibleHandles = nodeTypeToHandles[nodeType] || [];
      const sourceHandle = compatibleHandles.find(h => 
        handleTypesMap[h] === targetHandleColor
      );
      
      if (sourceHandle) {
        connection = {
          source: newNodeId,
          target: edgePicker.targetNodeId,
          sourceHandle: sourceHandle,
          targetHandle: edgePicker.targetHandleId,
        };
      }
    }
    
    if (connection) {
      setTimeout(() => {
        connectionMadeRef.current = false;
        onConnectRef.current(connection);
      }, 100);
    }
    
    setEdgePicker(null);
    setDraggedEdgeInfo(null);
  };

  const getCompatibleNodeTypes = (handleColor, isOutput) => {
    if (isOutput) {
      const compatibilityMap = {
        blue: ['textNode', 'imageNode', 'videoNode', 'audioNode', 'apiNode', 'concatNode'],
        green: ['imageNode', 'videoNode', 'apiNode'],
        orange: ['videoNode'],
        yellow: ['audioNode', 'videoNode']
      };
      return compatibilityMap[handleColor] || [];
    } else {
      const compatibilityMap = {
        blue: ['textNode', 'concatNode', 'apiNode'],
        green: ['imageNode', 'apiNode'],
        orange: ['videoNode'],
        yellow: ['audioNode']
      };
      return compatibilityMap[handleColor] || [];
    }
  };

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      position,
    });
  }, [screenToFlowPosition]);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const getNextId = (type) => {
    const count = nodes.filter(n => n.type === type).length + 1;
    return `${type.replace("Node","")}${count}`;
  };

  const getNewNodePosition = (lastNode) => {
    if (!lastNode) return { x: 250, y: 250 };

    const NODE_WIDTH = 320;
    const NODE_HEIGHT = 300;
    const GAP = 10;
    const MAX_ROW_WIDTH = 1200;

    // const offsetX = Math.random() * 200 - 100;
    // const offsetY = Math.random() * 200 - 100;

    // return {
    //   x: lastNode.position.x + offsetX,
    //   y: lastNode.position.y + offsetY
    // };
    const nextX = lastNode.position.x + NODE_WIDTH + GAP;

    if (nextX > MAX_ROW_WIDTH) {
      return {
        x: 250,
        y: lastNode.position.y + NODE_HEIGHT + GAP,
      };
    }

    return {
      x: nextX,
      y: lastNode.position.y,
    };
  };

  const addNode = (nodeType, position = null, initialData = {}) => {
    const isEmptyCanvas = nodes.length === 0;
    const id = getNextId(nodeType);
    let nodePosition;
    if (position) {
      nodePosition = position;
    } else {
      const lastNode = nodes[nodes.length - 1];
      nodePosition = getNewNodePosition(lastNode);
    }

    const newNode = {
      id,
      type: nodeType,
      position: nodePosition,
      data: { ...initialData },
    };

    setNodes((prev) => [...prev, newNode]);
    setDropDown(0);
    setContextMenu(null);
    if (!position) {
      setTimeout(() => fitView({ padding: isEmptyCanvas ? 1.2: 0.8, duration: 500, minZoom: isEmptyCanvas ? 0.15: 0.2 }), 0);
    }
  };

  const onKeyDown = useCallback((e) => {
    if (e.key === "Delete") {
      setNodes((nds) => {
        const deletedIds = nds.filter((n) => n.selected).map((n) => n.id);
        const remainingNodes = nds.filter((n) => !n.selected);
        setEdges((eds) => eds.filter(
          (e) => !deletedIds.includes(e.source) && !deletedIds.includes(e.target)
        ));
        return remainingNodes;
      });
    }
  }, []);

  const selectedNodes = nodes.filter(node => node.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  
  const updateNodeFromPanel = useCallback((key, value) => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode?.id) {
          return {
            ...node,
            data: {
              ...node.data,
              formValues: {
                ...node.data.formValues,
                [key]: value,
              },
            },
          };
        }
        return node;
      })
    );
  }, [selectedNode, setNodes]);

  const updateModel = useCallback((model) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              selectedModel: model,
            },
          };
        }
        return node;
      })
    );
    setDropDown(0);
  }, [selectedNode, setNodes]);

  const getModelsForNode = (node) => {
    if (!node || !nodeSchemas?.categories) return [];

    const mapModels = (modelsMap) => 
      modelsMap ? Object.entries(modelsMap).map(([id, model]) => ({
        ...model,
        id,
        name: SPECIAL_MODEL_NAMES[id] || formatName(id)
      })) : [];

    if (node.type === "textNode") return mapModels(nodeSchemas.categories.text?.models);
    if (node.type === "imageNode") return mapModels(nodeSchemas.categories.image?.models);
    if (node.type === "videoNode") return mapModels(nodeSchemas.categories.video?.models);
    if (node.type === "audioNode") return mapModels(nodeSchemas.categories.audio?.models);
    if (node.type === "apiNode") return filteredApiNodeModels;
    return [];
  };

  const getFilteredModelsForNode = (node) => {
    const models = getModelsForNode(node);

    if (!modelSearch.trim()) return models;
    const normalize = (text = "") =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const normalizedSearch = normalize(modelSearch);
    
    return models.filter((model) => {
      const name = normalize(model.name);
      const id = normalize(model.id);

      return (
        name.includes(normalizedSearch) ||
        id.includes(normalizedSearch)
      );
    });
  };

  const connectionLineStyle = {
    stroke: activeHandleColor === 'blue' ? '#3b82f6' 
          : activeHandleColor === 'green' ? '#22c55e'
          : activeHandleColor === 'orange' ? '#f97316'
          : activeHandleColor === 'yellow' ? '#eab308'
          : '#ffffffff',
    strokeWidth: 2,
  };

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} className="flex h-screen w-screen relative">
      {isRestoring && (
        <div className="fixed inset-0 flex items-center justify-center gap-2 bg-black w-full h-full z-20">
          <div className="w-6 h-6 rounded-full border-[4px] border-white border-t-transparent animate-spin"></div>
          <div className="text-white text-xl font-bold">Loading...</div>
        </div>
      )}
      <div className="flex items-center justify-center absolute top-0 z-20 bg-[#151618] w-full py-3 border-b border-gray-800">
        <div className="flex items-center justify-between w-full max-w-[95%] sm:max-w-[90%] lg:max-w-[80%]">
          <div className="flex items-center gap-2 w-[35%]">
            <Link
              href="/workflow"
              className="text-white"
            >
              <FaAngleLeft />
            </Link>
            <button
              type="button"
              onClick={() => setDropDown(prev => prev === 2 ? 0: 2)}
              disabled={!interactionMode}
              className="flex items-center gap-2 text-base outline-none text-[#adacaa] hover:text-white cursor-pointer bg-transparent max-w-[90%]"
            >
              <span className="truncate block w-full">{workflowName ? workflowName: "Untitled"}</span> <FaRegEdit size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {template.showTemplateBtn && (
              <button
                type="button"
                disabled={isRunning === 4}
                onClick={handleTemplatePublish}
                className="flex items-center gap-2 px-4 py-1.5 border border-gray-600/70 bg-white text-black text-sm rounded-full group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white"
              >
                {isRunning === 4 ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent border-black group-hover:border-white group-hover:border-t-transparent rounded-full animate-spin"></div> Template
                  </>
                ) : (
                  <>
                    <LuLayoutTemplate size={16} /> {template.isPublishedTemplate ? "Undo" : "Template"}
                  </>
                )}
              </button>
            )}
            {interactionMode ? (
              <>
                <button
                  type="button"
                  disabled={isRunning === 2 || !interactionMode}
                  onClick={handlePublishWorkflow}
                  className="flex items-center gap-2 px-4 py-1.5 border border-gray-600/70 bg-white text-black text-sm rounded-full group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white"
                >
                  {isRunning === 2 ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-black group-hover:border-white group-hover:border-t-transparent rounded-full animate-spin"></div> Publishing...
                    </>
                  ) : (
                    <>
                      <FaTelegramPlane size={16} /> {publishWorkflow ? "Unpublish" : "Publish"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isRunning === 1 || !interactionMode}
                  onClick={handleRunWorkflow}
                  className="flex items-center gap-2 px-4 py-1.5 border border-gray-600/70 bg-blue-500 text-white text-sm rounded-full group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white"
                >
                  {isRunning === 1 ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-black group-hover:border-white group-hover:border-t-transparent rounded-full animate-spin"></div> Running...
                    </>
                  ) : (
                    <>
                      <FaPlay size={16} /> Run All
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={interactionMode}
                onClick={handleDuplicateWorkflow}
                className="flex items-center gap-2 px-4 py-1.5 border border-gray-600/70 bg-white text-black text-sm rounded-full group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white"
              >
                {isRunning === 3 ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent border-black group-hover:border-white group-hover:border-t-transparent rounded-full animate-spin"></div> Duplicating...
                  </>
                ) : (
                  <>
                    <IoDuplicateOutline size={16} /> Duplicate
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={`absolute left-4 self-center z-20 flex flex-col gap-2 bg-[#151618] p-1 rounded-full border border-gray-700 shadow-xl ${isRestoring && "hidden"}`}>
        <button 
          type="button"
          onClick={() => toast.error("This workflow can't be edited.")} 
          className={`p-3 rounded-full bg-white hover:bg-[#1b1e23] cursor-pointer outline-none text-black active:bg-gray-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${interactionMode && "hidden"}`}
        >
          <MdLockOutline size={18} />
        </button>
        <div
          className={`relative ${!interactionMode && "hidden"}`}
          onBlur={(e) => {
            const currentTarget = e.currentTarget;
            setTimeout(() => {
              if (currentTarget && !currentTarget.contains(document.activeElement)) {
                setDropDown(0);
              }
            }, 100);
          }}
          tabIndex={0}
        >
          <button 
            type="button"
            disabled={!interactionMode}
            onClick={() => setDropDown((prev) => prev === 1 ? 0: 1)} 
            className={`p-3 rounded-full cursor-pointer outline-none transition disabled:opacity-50 disabled:cursor-not-allowed ${dropDown === 1 ? "bg-white text-black": "text-gray-300 active:bg-gray-600 hover:text-white hover:bg-[#1b1e23]"}`}
          >
            <FaPlus size={18} />
          </button>
          {dropDown === 1 && (
            <div className="absolute left-14 top-0 z-50">
              <NodesNavbar addNode={addNode} apiNodeModels={filteredApiNodeModels} nodeSchemas={nodeSchemas} />
            </div>
          )}
        </div>
        <div
          className={`relative ${!interactionMode && "hidden"}`}
          onBlur={(e) => {
            const currentTarget = e.currentTarget;
            setTimeout(() => {
              if (currentTarget && !currentTarget.contains(document.activeElement)) {
                setDropDown(0);
              }
            }, 100);
          }}
          tabIndex={0}
        >
          <button 
            type="button"
            disabled={!interactionMode}
            onClick={() => setDropDown((prev) => prev === 4 ? 0: 4)} 
            className={`p-3 rounded-full cursor-pointer outline-none transition disabled:opacity-50 disabled:cursor-not-allowed ${dropDown === 4 ? "bg-white text-black": "text-gray-300 active:bg-gray-600 hover:text-white hover:bg-[#1b1e23]"}`}
          >
            <FaToolbox size={18} />
          </button>
          {dropDown === 4 && (
            <div className="absolute left-14 top-0 bg-[#1b1e23] border border-gray-700 p-3 rounded-lg flex flex-col gap-2 w-52">
              <h3 className="w-full text-center text-sm text-gray-300">Utility Node</h3>
              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={() => addNode("concatNode")}
                  className="flex gap-2 justify-center items-center py-3 px-4 text-white cursor-pointer bg-[#2c3037] rounded hover:bg-[#212326]"
                >
                  <TbArrowMerge className="rotate-90" /> <span className="text-xs font-medium">Prompt Concatenator</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <button 
          type="button" 
          onClick={zoomIn}
          className="p-3 rounded-full hover:bg-[#1b1e23] cursor-pointer outline-none text-gray-300 active:bg-gray-600 hover:text-white transition"
        >
          <FiZoomIn size={18} />
        </button>
        <button 
          type="button" 
          onClick={zoomOut}
          className="p-3 rounded-full hover:bg-[#1b1e23] cursor-pointer outline-none text-gray-300 active:bg-gray-600 hover:text-white transition"
        >
          <FiZoomOut size={18} />
        </button>
        <button 
          type="button" 
          onClick={() => fitView({ padding: 0.4, duration: 500, minZoom: 0.2 })}
          className="p-3 rounded-full hover:bg-[#1b1e23] cursor-pointer outline-none text-gray-300 active:bg-blue-600 hover:text-white transition"
        >
          <MdOutlineZoomOutMap size={18} />
        </button>
        <button 
          type="button" 
          onClick={() => setIsDragging(!isDragging)}
          className={`p-3 rounded-full cursor-pointer outline-none active:bg-gray-600 transition ${!isDragging ? "bg-white text-black": "text-gray-300 hover:bg-[#1b1e23] hover:text-white"}`}
        >
          <LuMousePointer2 size={18} />
        </button>
      </div>
      <div className="z-10 w-full h-full">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={interactionMode ? onConnect : null}
          isValidConnection={isValidConnection}
          connectionMode="loose"
          onConnectStart={interactionMode ? onConnectStart : null}
          onConnectEnd={interactionMode ? onConnectEnd : null}
          nodeTypes={nodeTypes}
          onEdgeClick={interactionMode ? onEdgeClick: null}
          onPaneContextMenu={interactionMode ? onPaneContextMenu: null}
          onPaneClick={interactionMode ? onPaneClick: null}
          nodesDraggable={interactionMode}
          nodesConnectable={interactionMode}
          elementsSelectable={interactionMode}
          minZoom={0.1}
          maxZoom={4} 
          selectionOnDrag={!isDragging}
          panOnDrag={isDragging}
          selectionMode={!isDragging ? "partial" : null}
          multiSelectionKeyCode="Shift"
          connectionLineStyle={connectionLineStyle}
          fitView={() => fitView({ padding: 0.4, duration: 500, minZoom: 0.2 })}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          {edgePicker && (() => {
            const compatibleTypes = getCompatibleNodeTypes(edgePicker.handleColor, edgePicker.isOutput);
            
            return (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setEdgePicker(null)}
                  style={{ pointerEvents: 'auto' }}
                />
                <div
                  className="fixed z-50 pointer-events-auto"
                  style={{
                    left: `${edgePicker.cursorPos.x + 10}px`,
                    top: `${edgePicker.cursorPos.y}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <NodesNavbar 
                    addNode={handleSelectNodeFromEdgePicker}
                    apiNodeModels={filteredApiNodeModels}
                    filterNodeTypes={compatibleTypes}
                    nodeSchemas={nodeSchemas}
                  />
                </div>
              </>
            );
          })()}
        </ReactFlow>
      </div>
      {selectedNode && !["concatNode"].includes(selectedNode.type) && (
        <div className="absolute right-2 top-16 z-10 w-80 h-full max-h-[90%] bg-[#151618] border border-gray-500 rounded-xl flex">
          <button 
            type="button"
            className="absolute top-2 right-2 text-white cursor-pointer w-8 h-8 rounded flex items-center justify-center hover:bg-[#292c30] hover:text-red-500" 
            onClick={() => {
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
          >
            &#10005;
          </button>
          <div className="flex flex-col gap-4 h-full w-full">
            <h3 className="text-base text-center text-white mt-6">Properties</h3>
            <h1 className="flex items-center gap-2 text-base text-start text-white mx-4 bg-[#292c30] rounded px-2 py-1">
              {selectedNode.id.startsWith("text") ? <TfiText />: selectedNode.id.startsWith("image") ? <IoImageOutline />: selectedNode.id.startsWith("video") ? <IoVideocamOutline />: selectedNode.id.startsWith("audio") ? <AiOutlineAudio />: <RiInputMethodLine />}
              {selectedNode.id.replace(/(\D+)(\d+)/, "$1 $2").replace(/^./, (c) => c.toUpperCase())}
            </h1>
            <div className="flex flex-col gap-4 w-full h-full overflow-y-auto px-4">
              <div className="flex flex-col gap-4 w-full h-full">
                <div
                  className="flex flex-col gap-1 relative w-full" 
                  onBlur={(e) => {
                    const currentTarget = e.currentTarget;
                    setTimeout(() => {
                      if (currentTarget && !currentTarget.contains(document.activeElement)) {
                        setDropDown(-1);
                      }
                    }, 100);
                  }}
                  tabIndex={0}
                >
                  <label className="text-xs text-gray-300 capitalize text-start">Model Selection</label>
                  <button
                    type="button"
                    onClick={() => setDropDown(prev => prev === 3 ? 0: 3)}
                    className="flex items-center justify-between gap-1 text-sm text-center text-white w-full h-full cursor-pointer whitespace-nowrap px-2 py-[5px] border border-gray-600 focus:outline rounded"
                  >
                    {selectedNode?.data?.selectedModel?.name || ""}
                    <FaAngleDown size={14} className={`transition-all duration-300 ${dropDown === 3 && "rotate-180"}`} />
                  </button>
                  {dropDown === 3 && (
                    <div className="absolute left-0 top-14 bg-[#1c1e21] z-20 border border-gray-500 p-1 rounded-md flex flex-col gap-1 max-h-60 w-full">
                      <input
                        type="search"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search models..."
                        className="px-2 py-1 text-sm bg-[#151618] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none"
                      />
                      <div className="flex flex-col overflow-y-auto">
                        {getFilteredModelsForNode(selectedNode).length > 0 ? (
                          getFilteredModelsForNode(selectedNode).map((model, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 p-1 cursor-pointer ${
                                selectedNode?.data?.selectedModel?.id === model.id
                                  ? "text-white"
                                  : "text-gray-400 hover:text-white"
                              }`}
                              onClick={() => {
                                updateModel(model);
                                setDropDown(0);
                                setModelSearch("");
                              }}
                            >
                              <h2 className="text-sm whitespace-nowrap">{model.name}</h2>
                              {selectedNode?.data?.selectedModel?.id === model.id && (
                                <FaCheck size={12} className="ml-auto" />
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-2">
                            No models found
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedNode?.data?.selectedModel ? (
                  (() => {
                    const nodeType = selectedNode.id.startsWith("text") ? "text": selectedNode.id.startsWith("image") ? "image": selectedNode.id.startsWith("video") ? "video": "audio";
                    const inputSchema = nodeSchemas?.categories?.[nodeType]?.models[selectedNode?.data?.selectedModel?.id]?.input_schema?.schemas?.input_data || {};

                    return selectedNode?.data?.loading === 1 ? (
                      <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-white">Fetching model...</span>
                      </div>
                    ) : selectedNode.type === "apiNode" ? (
                      <div className="flex flex-col gap-2 w-full h-full relative pt-2">
                        <button
                          type="button"
                          onClick={() => selectedNode && runNodeInputsFromFlow(selectedNode.id)}
                          disabled={selectedNode?.data?.loading === 1}
                          className="absolute top-0 z-10 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 group disabled:cursor-not-allowed rounded text-black bg-white px-2 py-1 border border-gray-500 hover:text-white hover:bg-black self-end"
                        >
                          {selectedNode?.data?.loading === 1 ? (
                            <><div className="w-3 h-3 rounded-full border border-t-transparent group-hover:border-t-transparent border-black group-hover:border-white animate-spin"></div>Generating...</>
                          ) : (
                            <>Fetch Model</>
                          )}
                        </button>
                        {Object.entries(selectedNode?.data?.taskData || {}).map(([key, meta], idx) => {
                          const hardcodedKeys = Object.keys(selectedNode?.data?.selectedModel?.input_params?.properties || {});
                          const isHardcoded = hardcodedKeys.includes(key);

                          return (
                            <RenderApiField 
                              key={key} 
                              fieldName={key}
                              meta={meta} 
                              idx={idx} 
                              formValues={selectedNode?.data?.formValues || {}}
                              setFormValues={(newValues) => {
                                setNodes((nds) =>
                                  nds.map((node) => {
                                    if (node.id === selectedNode?.id) {
                                      let updatedFormValues = typeof newValues === 'function' 
                                        ? newValues(node.data?.formValues || {})
                                        : newValues;

                                      if (key === 'model_name' && node.data.dynamicSchemas) {
                                        const modelNameValue = updatedFormValues.model_name;
                                        const matchedModel = Object.values(node.data.dynamicSchemas).find(m => m.model_id === modelNameValue);
                                        if (matchedModel && matchedModel.model_type) {
                                          updatedFormValues = { ...updatedFormValues, model_type: matchedModel.model_type };
                                        }
                                      }

                                      return {
                                        ...node,
                                        data: {
                                          ...node.data,
                                          formValues: updatedFormValues,
                                        },
                                      };
                                    }
                                    return node;
                                  })
                                );
                              }}
                              exposedHandles={selectedNode?.data?.exposedHandles || []}
                              onToggleHandle={isHardcoded ? null : (field) => {
                                const current = selectedNode?.data?.exposedHandles || [];
                                const isRemoving = current.includes(field);
                                if (isRemoving) {
                                  setEdges((eds) => eds.filter(e => !(e.target === selectedNode?.id && e.targetHandle === field)));
                                }
                                setNodes((nds) =>
                                  nds.map((node) => {
                                    if (node.id === selectedNode?.id) {
                                      const updated = isRemoving
                                        ? current.filter(h => h !== field)
                                        : [...current, field];
                                      return {
                                        ...node,
                                        data: {
                                          ...node.data,
                                          exposedHandles: updated,
                                        },
                                      };
                                    }
                                    return node;
                                  })
                                );
                              }}
                              handleChange={(field, value) => {
                                updateNodeFromPanel(field, value);

                                if (field === 'model_name' && selectedNode.data.dynamicSchemas) {
                                  const matchedModel = Object.values(selectedNode.data.dynamicSchemas).find(m => m.model_id === value);
                                  if (matchedModel && matchedModel.model_type) {
                                    updateNodeFromPanel('model_type', matchedModel.model_type);
                                  }
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : Object.keys(inputSchema).length > 0 ? (
                      Object.entries(inputSchema?.properties).map(([key, meta], idx) => (
                        <RenderField 
                          key={key} 
                          fieldName={key} 
                          meta={meta} 
                          idx={idx} 
                          formValues={selectedNode?.data?.formValues || {}}
                          setFormValues={(newValues) => {
                            setNodes((nds) =>
                              nds.map((node) => {
                                if (node.id === selectedNode?.id) {
                                  return {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      formValues: typeof newValues === 'function' 
                                        ? newValues(node.data?.formValues || {})
                                        : newValues,
                                    },
                                  };
                                }
                                return node;
                              })
                            );
                          }}
                          handleChange={updateNodeFromPanel}
                          data={inputSchema}
                          modelName={selectedNode?.data?.selectedModel?.name}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-400">No properties available</p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">Please select a model first</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <button
                type="button"
                onClick={() => selectedNode && runNodeFromFlow(selectedNode.id)}
                disabled={loadingNodes[selectedNode.id]}
                className="text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 group disabled:cursor-not-allowed rounded text-black bg-white px-2 py-2 border border-gray-500 hover:text-white hover:bg-black w-full"
              >
                {loadingNodes[selectedNode.id] ? (
                  <><div className="w-3 h-3 rounded-full border border-t-transparent group-hover:border-t-transparent border-black group-hover:border-white animate-spin"></div>Generating...</>
                ) : (
                  <><BsArrowUpCircleFill size={16} /> Generate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {contextMenu && (
        <div
          className="fixed z-40"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <NodesNavbar 
            addNode={(type, _, data) => addNode(type, contextMenu.position, data)} 
            apiNodeModels={filteredApiNodeModels}
            nodeSchemas={nodeSchemas}
          />
        </div>
      )}
      <div 
        className={`fixed inset-0 flex flex-col items-center justify-center z-50 overflow-auto bg-black/30 backdrop-blur transition-all duration-200 ease-in-out ${
          dropDown === 2 ? "opacity-100 scale-100 visible" : "opacity-0 scale-80 invisible"
        }`}
        onClick={() => setDropDown(0)}
      >
        <div className="bg-[#242629] rounded-lg p-4 w-72 shadow-lg flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base text-center font-semibold text-black dark:text-white">Save Workflow</h3>
          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs text-start text-gray-700 dark:text-gray-300">Workflow Name</label>
            <input 
              type="text" 
              value={workflowName} 
              autoFocus
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Enter Workflow Name"
              className="border border-gray-700 px-2 py-1.5 text-sm text-white rounded bg-transparent w-full" 
            />
          </div>
          <div className="flex items-center w-full gap-2">
            <button
              type="button"
              onClick={() => setDropDown(0)}
              className="px-4 py-2 bg-gray-700/50 text-white rounded-full text-sm hover:bg-gray-600/50 transition w-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveWorkFlow}
              className="px-4 py-2 bg-white text-black rounded-full hover:bg-blue-500 hover:text-white transition w-full text-sm cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
      {nodes.length === 0 && !isPresetsDismissed && interactionMode && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300 transform scale-90 md:scale-100 overflow-y-auto custom-scrollbar max-w-[90%] max-h-[80%] p-10">
            <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-md px-6 py-3 rounded-lg border border-white/10 shadow-xl">
              <h2 className="text-xl font-semibold text-white tracking-tight">Select a Workflow</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">or start from scratch</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className="group relative flex flex-col bg-[#151618] aspect-[4/3] border border-gray-700 hover:border-gray-500 rounded-lg shadow-xl hover:shadow-2xl hover:scale-105 cursor-pointer transition-all duration-200 overflow-hidden text-left"
                >
                  <div className="z-10 p-2 bg-[#242629] border-b border-gray-700 flex items-center px-3 justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${preset.id === "empty-workflow" ? "bg-gray-400" : "bg-blue-500"}`}></div>
                      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{preset.id === "empty-workflow" ? "NEW" : "PRESET"}</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                    </div>
                  </div>
                  <div className="z-0 p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-center gap-2 z-10 w-full h-full">
                      <div className="text-white group-hover:text-blue-400 transition-colors">
                        {iconMap[preset.icon] || <RiInputMethodLine size={16} />}
                      </div>
                      <h3 className="text-sm font-medium text-white leading-tight group-hover:text-blue-400 transition-colors">
                        {preset.title}
                      </h3>
                    </div>
                    {preset.image && (
                      <div className="absolute inset-0 z-0 w-full h-full rounded overflow-hidden border border-gray-800">
                        <img src={preset.image} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 z-10 w-full h-full bg-black/60"></div>
                      </div>
                    )}
                    {preset.description && (
                      <p className="z-10 text-[11px] text-gray-300 leading-relaxed border-t border-gray-500 pt-2 mt-auto">
                        {preset.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button 
              type="button"
              onClick={() => setIsPresetsDismissed(true)}
              className="mt-4 px-5 py-2 rounded-full bg-gray-800/80 hover:bg-gray-700 text-xs text-gray-300 font-medium transition-colors border border-gray-700 hover:border-gray-500"
            >
              Dismiss & Enter Empty Canvas
            </button>
          </div>
        </div>
      )}
      {interactionMode && (
        <ChatWidget 
          isOpen={isChatOpen} 
          toggleChat={() => setIsChatOpen(!isChatOpen)} 
          messages={chatMessages} 
          onSendMessage={handleSendMessage} 
          isLoading={isChatLoading}
          onClearHistory={() => setChatMessages([])}
        />
      )}
      <ToastContainer />
    </div>
  );
};

export default NodeFlow;
