import { useState, type ReactNode } from 'react';
import { Plus, Trash2, Edit2, Download, Upload, X } from 'lucide-react';
import { DEFAULT_MODELS, getModelDisplayName } from '@/api/models';
import { useModels } from '@/hooks/useModels';
import { useModelLibrary } from '@/store/models';
import { useProviderLibrary } from '@/store/providers';
import type { ModelDef, ModelParameter, Modality, Provider } from '@/types/model';
import type { ProviderMode } from '@/types/provider';
import { isValidId, isRequired, isValidModelId, isValidUrl } from '@/utils/validation';

type TabType = 'image' | 'video' | 'chat';

export function ModelManager() {
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [editingModel, setEditingModel] = useState<ModelDef | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const imageModels = useModels('image');
  const videoModels = useModels('video');
  const chatModels = useModels('chat');

  const { upsert, remove, exportModels, importModels, setOverride } = useModelLibrary();

  const allModels =
    activeTab === 'image' ? imageModels : activeTab === 'video' ? videoModels : chatModels;

  const currentModels = searchQuery
    ? allModels.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.group?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allModels;

  const handleAdd = () => {
    setEditingModel({
      id: '',
      name: '',
      provider: 'custom',
      modality: activeTab,
      parameters: [],
    });
    setShowForm(true);
  };

  const handleEdit = (model: ModelDef) => {
    setEditingModel(model);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const isDefaultModel = DEFAULT_MODELS.some((item) => item.id === id);
    const message = isDefaultModel
      ? '确定要从模型列表中隐藏这个内置模型吗？现有画布节点仍可继续识别该模型。'
      : '确定要删除这个模型吗？';
    if (confirm(message)) {
      if (isDefaultModel) {
        setOverride(id, { hidden: true });
        return;
      }
      remove(id);
    }
  };

  const handleSave = (model: ModelDef) => {
    const originalId = editingModel?.id;
    const isDefaultModel = originalId
      ? DEFAULT_MODELS.some((item) => item.id === originalId)
      : false;
    if (isDefaultModel) {
      setOverride(model.id, model);
    } else {
      if (originalId && originalId !== model.id) {
        remove(originalId);
      }
      upsert(model);
    }
    setShowForm(false);
    setEditingModel(null);
  };

  const handleExport = () => {
    const json = exportModels();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `models-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = importModels(text);
      if (result.success) {
        alert('导入成功！');
      } else {
        alert(`导入失败：${result.error}`);
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <TabButton active={activeTab === 'image'} onClick={() => setActiveTab('image')}>
            图像模型
          </TabButton>
          <TabButton active={activeTab === 'video'} onClick={() => setActiveTab('video')}>
            视频模型
          </TabButton>
          <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
            文本模型
          </TabButton>
        </div>
        <div className="flex gap-1">
          <IconButton onClick={handleImport} title="导入">
            <Upload className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={handleExport} title="导出">
            <Download className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={handleAdd} title="添加模型">
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <input
        type="text"
        className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-blue-400"
        placeholder="搜索模型名称、ID、服务商或分组..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        {currentModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onEdit={() => handleEdit(model)}
            onDelete={() => handleDelete(model.id)}
          />
        ))}
        {currentModels.length === 0 && (
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
            {searchQuery
              ? '未找到匹配的模型'
              : `暂无${activeTab === 'image' ? '图像' : activeTab === 'video' ? '视频' : '文本'}模型`}
          </div>
        )}
      </div>

      {showForm && editingModel && (
        <ModelForm
          model={editingModel}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingModel(null);
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="rounded border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function ModelCard({
  model,
  onEdit,
  onDelete,
}: {
  model: ModelDef;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded border border-zinc-200 bg-white p-2">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800">
            {getModelDisplayName(model)}
          </span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
            {model.provider}
          </span>
          {model.group && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
              {model.group}
            </span>
          )}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">ID: {model.id}</div>
        {model.parameters && model.parameters.length > 0 && (
          <div className="mt-1 text-[10px] text-zinc-500">
            参数: {model.parameters.map((p) => p.label).join(', ')}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded p-1 text-red-500 hover:bg-red-50"
          onClick={onDelete}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
          onClick={onEdit}
          title="编辑"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}


function ModelForm({
  model,
  onSave,
  onCancel,
}: {
  model: ModelDef;
  onSave: (model: ModelDef) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ModelDef>(model);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [providerMode, setProviderMode] = useState<ProviderMode>(
    model.providerAssignment?.mode || 'global'
  );
  const [isIdDirty, setIsIdDirty] = useState(Boolean(model.id));
  const { providers } = useProviderLibrary();
  const { userModels } = useModelLibrary();
  const isDefaultModel = DEFAULT_MODELS.some((item) => item.id === model.id);

  const updateDraft = <K extends keyof ModelDef>(key: K, value: ModelDef[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const updateName = (name: string) => {
    setDraft((prev) => ({
      ...prev,
      name,
      id: isIdDirty ? prev.id : name,
    }));
    setErrors((prev) => ({ ...prev, name: '', id: '' }));
  };

  const updateModelId = (id: string) => {
    setIsIdDirty(true);
    updateDraft('id', id);
  };

  const addParameter = () => {
    const newParam: ModelParameter = {
      key: '',
      label: '',
      type: 'text',
      defaultValue: '',
    };
    setDraft((prev) => ({
      ...prev,
      parameters: [...(prev.parameters || []), newParam],
    }));
  };

  const updateParameter = (index: number, param: ModelParameter) => {
    setDraft((prev) => ({
      ...prev,
      parameters: prev.parameters?.map((p, i) => (i === index ? param : p)),
    }));
  };

  const removeParameter = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // ID 验证
    if (!isRequired(draft.id)) {
      newErrors.id = '模型 ID 不能为空';
    } else if (!isValidModelId(draft.id)) {
      newErrors.id = '模型 ID 不能包含空格或 < > { } [ ] \\ | 引号等特殊字符';
    } else if (
      DEFAULT_MODELS.some((m) => m.id === draft.id && m.id !== model.id) ||
      userModels.some((m) => m.id === draft.id && m.id !== model.id)
    ) {
      newErrors.id = 'ID 已存在，请使用其他 ID';
    }

    // 名称验证
    if (!isRequired(draft.name)) {
      newErrors.name = '模型名称不能为空';
    }

    // 服务商配置验证
    if (providerMode === 'reference') {
      if (draft.providerAssignment?.mode === 'reference') {
        if (!draft.providerAssignment.providerId) {
          newErrors.providerId = '请选择服务商';
        }
      }
    } else if (providerMode === 'inline') {
      if (draft.providerAssignment?.mode === 'inline') {
        if (!isRequired(draft.providerAssignment.config.baseUrl)) {
          newErrors.baseUrl = 'Base URL 不能为空';
        } else if (!isValidUrl(draft.providerAssignment.config.baseUrl)) {
          newErrors.baseUrl = 'Base URL 格式不正确';
        }
        if (!isRequired(draft.providerAssignment.config.apiKey)) {
          newErrors.apiKey = 'API Key 不能为空';
        }
      }
    }

    // 参数验证
    if (draft.parameters) {
      for (let i = 0; i < draft.parameters.length; i++) {
        const param = draft.parameters[i];
        if (!isRequired(param.key)) {
          newErrors[`param_${i}_key`] = '参数 key 不能为空';
        } else if (!isValidId(param.key)) {
          newErrors[`param_${i}_key`] = 'key 只能包含字母、数字、连字符和下划线';
        }
        if (!isRequired(param.label)) {
          newErrors[`param_${i}_label`] = '参数标签不能为空';
        }
        // 检查重复的 key
        const duplicateKey = draft.parameters.filter((p) => p.key === param.key).length > 1;
        if (duplicateKey) {
          newErrors[`param_${i}_key`] = '参数 key 重复';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-h-[90vh] w-[500px] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            {model.id ? '编辑模型' : '添加模型'}
          </h3>
          <button
            type="button"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <FormField label="模型 ID" error={errors.id}>
            <input
              type="text"
              className={inputCls}
              value={draft.id}
              onChange={(e) => updateModelId(e.target.value)}
              placeholder="my-custom-model"
              disabled={isDefaultModel}
            />
          </FormField>

          <FormField label="模型名称" error={errors.name}>
            <input
              type="text"
              className={inputCls}
              value={draft.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="My Custom Model"
            />
          </FormField>

          <FormField label="服务商类型">
            <select
              className={inputCls}
              value={draft.provider}
              onChange={(e) => updateDraft('provider', e.target.value as Provider)}
            >
              <option value="custom">Custom</option>
              <option value="openai">OpenAI</option>
              <option value="jimeng">Jimeng</option>
              <option value="midjourney">Midjourney</option>
              <option value="qwen">Qwen</option>
              <option value="deepseek">Deepseek</option>
              <option value="yunwu">Yunwu</option>
            </select>
          </FormField>

          <FormField label="服务商配置模式">
            <select
              className={inputCls}
              value={providerMode}
              onChange={(e) => {
                const mode = e.target.value as ProviderMode;
                setProviderMode(mode);
                if (mode === 'global') {
                  updateDraft('providerAssignment', { mode: 'global' });
                } else if (mode === 'reference') {
                  updateDraft('providerAssignment', {
                    mode: 'reference',
                    providerId: providers[0]?.id || '',
                  });
                } else {
                  updateDraft('providerAssignment', {
                    mode: 'inline',
                    config: { baseUrl: '', apiKey: '' },
                  });
                }
              }}
            >
              <option value="global">使用全局配置</option>
              <option value="reference">引用已配置的服务商</option>
              <option value="inline">直接配置</option>
            </select>
          </FormField>

          {providerMode === 'reference' && (
            <>
              <FormField label="选择服务商" error={errors.providerId}>
                <select
                  className={inputCls}
                  value={
                    draft.providerAssignment?.mode === 'reference'
                      ? draft.providerAssignment.providerId
                      : ''
                  }
                  onChange={(e) => {
                    if (draft.providerAssignment?.mode === 'reference') {
                      updateDraft('providerAssignment', {
                        ...draft.providerAssignment,
                        providerId: e.target.value,
                      });
                    }
                  }}
                >
                  {providers.length === 0 && <option value="">暂无服务商</option>}
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="text-[10px] text-zinc-500">
                可选：覆盖服务商的部分配置
              </div>
              <FormField label="覆盖 API Key（可选）">
                <input
                  type="password"
                  className={inputCls}
                  value={
                    draft.providerAssignment?.mode === 'reference'
                      ? draft.providerAssignment.overrides?.apiKey || ''
                      : ''
                  }
                  onChange={(e) => {
                    if (draft.providerAssignment?.mode === 'reference') {
                      updateDraft('providerAssignment', {
                        ...draft.providerAssignment,
                        overrides: {
                          ...draft.providerAssignment.overrides,
                          apiKey: e.target.value || undefined,
                        },
                      });
                    }
                  }}
                  placeholder="留空使用服务商配置"
                />
              </FormField>
              <FormField label="覆盖 Base URL（可选）">
                <input
                  type="text"
                  className={inputCls}
                  value={
                    draft.providerAssignment?.mode === 'reference'
                      ? draft.providerAssignment.overrides?.baseUrl || ''
                      : ''
                  }
                  onChange={(e) => {
                    if (draft.providerAssignment?.mode === 'reference') {
                      updateDraft('providerAssignment', {
                        ...draft.providerAssignment,
                        overrides: {
                          ...draft.providerAssignment.overrides,
                          baseUrl: e.target.value || undefined,
                        },
                      });
                    }
                  }}
                  placeholder="留空使用服务商配置"
                />
              </FormField>
            </>
          )}

          {providerMode === 'inline' && (
            <>
              <FormField label="Base URL" error={errors.baseUrl}>
                <input
                  type="text"
                  className={inputCls}
                  value={
                    draft.providerAssignment?.mode === 'inline'
                      ? draft.providerAssignment.config.baseUrl
                      : ''
                  }
                  onChange={(e) => {
                    if (draft.providerAssignment?.mode === 'inline') {
                      updateDraft('providerAssignment', {
                        ...draft.providerAssignment,
                        config: {
                          ...draft.providerAssignment.config,
                          baseUrl: e.target.value,
                        },
                      });
                    }
                  }}
                  placeholder="https://api.example.com"
                />
              </FormField>
              <FormField label="API Key" error={errors.apiKey}>
                <input
                  type="password"
                  className={inputCls}
                  value={
                    draft.providerAssignment?.mode === 'inline'
                      ? draft.providerAssignment.config.apiKey
                      : ''
                  }
                  onChange={(e) => {
                    if (draft.providerAssignment?.mode === 'inline') {
                      updateDraft('providerAssignment', {
                        ...draft.providerAssignment,
                        config: {
                          ...draft.providerAssignment.config,
                          apiKey: e.target.value,
                        },
                      });
                    }
                  }}
                  placeholder="sk-..."
                />
              </FormField>
            </>
          )}

          <FormField label="模型类型">
            <select
              className={inputCls}
              value={draft.modality}
              onChange={(e) => updateDraft('modality', e.target.value as Modality)}
            >
              <option value="image">图像</option>
              <option value="video">视频</option>
              <option value="chat">文本</option>
            </select>
          </FormField>

          <FormField label="分组（可选）">
            <input
              type="text"
              className={inputCls}
              value={draft.group || ''}
              onChange={(e) => updateDraft('group', e.target.value || undefined)}
              placeholder="例如: Flux, Wan"
            />
          </FormField>

          <div className="mt-2 border-t border-zinc-200 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700">模型参数</span>
              <button
                type="button"
                className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                onClick={addParameter}
              >
                <Plus className="h-3 w-3" />
                添加参数
              </button>
            </div>

            {draft.parameters?.map((param, index) => (
              <ParameterEditor
                key={index}
                param={param}
                index={index}
                errors={errors}
                onChange={(p) => updateParameter(index, p)}
                onRemove={() => removeParameter(index)}
              />
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-zinc-200 bg-white px-4 py-3">
          <button
            type="button"
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={handleSubmit}
          >
            保存
          </button>
          <button
            type="button"
            className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}


function ParameterEditor({
  param,
  index,
  errors,
  onChange,
  onRemove,
}: {
  param: ModelParameter;
  index: number;
  errors: Record<string, string>;
  onChange: (param: ModelParameter) => void;
  onRemove: () => void;
}) {
  const updateParam = <K extends keyof ModelParameter>(key: K, value: ModelParameter[K]) => {
    onChange({ ...param, [key]: value });
  };

  const addOption = () => {
    const newOptions = [...(param.options || []), { label: '', value: '' }];
    updateParam('options', newOptions);
  };

  const updateOption = (optIndex: number, field: 'label' | 'value', value: string) => {
    const newOptions = param.options?.map((opt, i) =>
      i === optIndex ? { ...opt, [field]: value } : opt,
    );
    updateParam('options', newOptions);
  };

  const removeOption = (optIndex: number) => {
    const newOptions = param.options?.filter((_, i) => i !== optIndex);
    updateParam('options', newOptions);
  };

  return (
    <div className="mb-3 rounded border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-700">参数 #{index + 1}</span>
        <button
          type="button"
          className="rounded p-1 text-red-500 hover:bg-red-50"
          onClick={onRemove}
          title="删除参数"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <FormField label="Key" error={errors[`param_${index}_key`]} compact>
          <input
            type="text"
            className={inputCls}
            value={param.key}
            onChange={(e) => updateParam('key', e.target.value)}
            placeholder="temperature"
          />
        </FormField>

        <FormField label="标签" error={errors[`param_${index}_label`]} compact>
          <input
            type="text"
            className={inputCls}
            value={param.label}
            onChange={(e) => updateParam('label', e.target.value)}
            placeholder="温度"
          />
        </FormField>

        <FormField label="类型" compact>
          <select
            className={inputCls}
            value={param.type}
            onChange={(e) =>
              updateParam('type', e.target.value as 'text' | 'number' | 'select' | 'boolean')
            }
          >
            <option value="text">文本</option>
            <option value="number">数值</option>
            <option value="select">选择</option>
            <option value="boolean">布尔</option>
          </select>
        </FormField>

        <FormField label="默认值" compact>
          {param.type === 'boolean' ? (
            <select
              className={inputCls}
              value={String(param.defaultValue)}
              onChange={(e) => updateParam('defaultValue', e.target.value === 'true')}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : param.type === 'number' ? (
            <input
              type="number"
              className={inputCls}
              value={param.defaultValue as number}
              onChange={(e) => updateParam('defaultValue', Number(e.target.value))}
            />
          ) : (
            <input
              type="text"
              className={inputCls}
              value={param.defaultValue as string}
              onChange={(e) => updateParam('defaultValue', e.target.value)}
            />
          )}
        </FormField>

        {param.type === 'number' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="最小值" compact>
                <input
                  type="number"
                  className={inputCls}
                  value={param.min ?? ''}
                  onChange={(e) =>
                    updateParam('min', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </FormField>
              <FormField label="最大值" compact>
                <input
                  type="number"
                  className={inputCls}
                  value={param.max ?? ''}
                  onChange={(e) =>
                    updateParam('max', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </FormField>
              <FormField label="步长" compact>
                <input
                  type="number"
                  className={inputCls}
                  value={param.step ?? ''}
                  onChange={(e) =>
                    updateParam('step', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </FormField>
            </div>
          </>
        )}

        {param.type === 'select' && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-zinc-600">选项</span>
              <button
                type="button"
                className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-300"
                onClick={addOption}
              >
                + 添加
              </button>
            </div>
            {param.options?.map((opt, optIndex) => (
              <div key={optIndex} className="mb-1 flex gap-1">
                <input
                  type="text"
                  className={`${inputCls} flex-1`}
                  placeholder="标签"
                  value={opt.label}
                  onChange={(e) => updateOption(optIndex, 'label', e.target.value)}
                />
                <input
                  type="text"
                  className={`${inputCls} flex-1`}
                  placeholder="值"
                  value={opt.value}
                  onChange={(e) => updateOption(optIndex, 'value', e.target.value)}
                />
                <button
                  type="button"
                  className="rounded border border-zinc-200 p-1 text-red-500 hover:bg-red-50"
                  onClick={() => removeOption(optIndex)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <FormField label="描述（可选）" compact>
          <input
            type="text"
            className={inputCls}
            value={param.description || ''}
            onChange={(e) => updateParam('description', e.target.value || undefined)}
            placeholder="参数说明"
          />
        </FormField>
      </div>
    </div>
  );
}

function FormField({
  label,
  error,
  compact,
  children,
}: {
  label: string;
  error?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-zinc-600`}>{label}</span>
      {children}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-blue-400';
