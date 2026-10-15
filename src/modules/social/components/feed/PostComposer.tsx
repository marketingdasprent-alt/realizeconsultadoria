import React, { useRef, useState } from 'react';
import { Building2, ImagePlus, Loader2, Paperclip, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { MAX_POST_FILES, POST_FILE_TYPES } from '../../lib/feed';
import type { NewPostInput } from '../../types';

interface PostComposerProps {
  onPublish: (input: NewPostInput) => Promise<boolean>;
  isPublishing: boolean;
}

const TOOL =
  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-primary';

/** Nova publicação: texto, imagens/documentos e público (empresa ou departamento). */
export const PostComposer: React.FC<PostComposerProps> = ({ onPublish, isPublishing }) => {
  const { user } = useWorkspace();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [audience, setAudience] = useState<NewPostInput['audience']>('company');
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canPublish = (body.trim().length > 0 || files.length > 0) && !isPublishing;

  const addFiles = (list: FileList | null) =>
    list && setFiles(current => [...current, ...Array.from(list)].slice(0, MAX_POST_FILES));

  const publish = async () => {
    if (!canPublish) return;
    if (await onPublish({ body, audience, files })) {
      setBody('');
      setFiles([]);
      setAudience('company');
    }
  };

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line md:p-5">
      <div className="flex gap-3">
        <UserAvatar name={user.name} size="md" />
        <textarea
          value={body}
          onChange={event => setBody(event.target.value.slice(0, 5000))}
          rows={body ? Math.min(8, body.split('\n').length + 1) : 2}
          placeholder={`Partilhe uma novidade, ${user.name.split(' ')[0]}… use #hashtags`}
          className="min-h-[52px] flex-1 resize-none rounded-2xl bg-rz-canvas px-4 py-3 text-[15px] outline-none ring-1 ring-transparent placeholder:text-rz-muted focus:bg-white focus:ring-rz-primary/40"
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 pl-14">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="inline-flex max-w-[14rem] items-center gap-2 rounded-full bg-rz-primary-soft py-1 pl-3 pr-1 text-[12.5px] font-semibold text-rz-primary"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFiles(list => list.filter((_, i) => i !== index))}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
                aria-label={`Retirar ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 md:pl-12">
        <button type="button" className={TOOL} onClick={() => imageRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> Fotografia
        </button>
        <button type="button" className={TOOL} onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4" /> Documento
        </button>
        <div className="flex rounded-full bg-rz-canvas p-0.5">
          {(['company', 'department'] as const).map(option => {
            const Icon = option === 'company' ? Building2 : Users;
            const disabled = option === 'department' && !user.department;
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => setAudience(option)}
                title={disabled ? 'Sem departamento na sua ficha' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors disabled:opacity-40',
                  audience === option ? 'bg-white text-rz-ink shadow-sm' : 'text-rz-muted'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {option === 'company' ? 'Toda a empresa' : (user.department ?? 'Departamento')}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white shadow-[0_10px_20px_-10px_hsl(var(--rz-primary))] transition-opacity disabled:opacity-40"
        >
          {isPublishing && <Loader2 className="h-4 w-4 animate-spin" />} Publicar
        </button>
      </div>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={event => (addFiles(event.target.files), (event.target.value = ''))}
      />
      <input
        ref={fileRef}
        type="file"
        accept={POST_FILE_TYPES.filter(type => !type.startsWith('image/')).join(',')}
        multiple
        className="hidden"
        onChange={event => (addFiles(event.target.files), (event.target.value = ''))}
      />
    </section>
  );
};
