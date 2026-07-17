import { NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { Node } from '@tiptap/core'
import {
  Loader2, Headphones, Upload, X, ArrowLeftRight,
  CheckCircle2, AlertCircle, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX,
} from 'lucide-react'
import React from 'react'
import toast from 'react-hot-toast'
import { uploadNewAudioFile } from '../../../../../services/blocks/Audio/audio'
import { getAudioBlockStreamUrl } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { useCourse } from '@components/Contexts/CourseContext'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { constructAcceptValue } from '@/lib/constants'
import { cn } from '@/lib/utils'

const SUPPORTED_FILES = constructAcceptValue(['mp3', 'wav', 'ogg', 'm4a'])

const AUDIO_SIZES = {
  small: { maxWidth: 400, label: 'Small' },
  medium: { maxWidth: 600, label: 'Medium' },
  large: { maxWidth: 800, label: 'Large' },
  full: { maxWidth: '100%', label: 'Full Width' },
} as const

type AudioSize = keyof typeof AUDIO_SIZES

interface AudioBlockObject {
  block_uuid?: string
  source_type: 'upload'
  content?: {
    file_id: string
    file_format: string
    activity_uuid?: string
  }
  size: AudioSize
}

interface Organization {
  org_uuid: string
}

interface Course {
  courseStructure: {
    course_uuid: string
  }
}

interface EditorState {
  isEditable: boolean
}

interface Session {
  data?: {
    tokens?: {
      access_token?: string
    }
  }
}

interface ExtendedNodeViewProps extends Omit<NodeViewProps, 'extension'> {
  extension: Node & {
    options: {
      activity: {
        activity_uuid: string
      }
    }
  }
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
  return `${m}:${r.toString().padStart(2, '0')}`
}

function InlineAudioPlayer({ src, title }: { src: string; title?: string }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const progressRef = React.useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState(1)
  const [isMuted, setIsMuted] = React.useState(false)
  const [prevVolume, setPrevVolume] = React.useState(1)

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) { audio.pause() } else { audio.play() }
    setIsPlaying(!isPlaying)
  }

  const skip = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, duration))
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isMuted) {
      audio.volume = prevVolume
      setVolume(prevVolume)
    } else {
      setPrevVolume(volume)
      audio.volume = 0
      setVolume(0)
    }
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.volume = v
    setVolume(v)
    setIsMuted(v === 0)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <Headphones size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900 truncate">{title}</span>
        </div>
      )}

      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => skip(-15)}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors outline-none"
          title="Skip back 15s"
        >
          <SkipBack size={16} className="text-gray-600" />
        </button>

        <button
          onClick={togglePlay}
          className="rounded-full bg-gray-900 hover:bg-gray-800 p-2.5 transition-colors outline-none"
        >
          {isPlaying ? (
            <Pause size={16} className="text-white" fill="white" />
          ) : (
            <Play size={16} className="text-white" fill="white" />
          )}
        </button>

        <button
          onClick={() => skip(15)}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors outline-none"
          title="Skip forward 15s"
        >
          <SkipForward size={16} className="text-gray-600" />
        </button>

        <span className="text-xs text-gray-500 w-10 text-right tabular-nums flex-shrink-0">
          {formatTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          onClick={seekTo}
          className="flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer relative group"
        >
          <div
            className="h-full bg-gray-900 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        <span className="text-xs text-gray-500 w-10 tabular-nums flex-shrink-0">
          {formatTime(duration)}
        </span>

        <button
          onClick={toggleMute}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors outline-none"
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={16} className="text-gray-600" />
          ) : (
            <Volume2 size={16} className="text-gray-600" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
        />
      </div>
    </div>
  )
}

function AudioBlockComponent(props: ExtendedNodeViewProps) {
  const { node, extension, updateAttributes } = props
  const org = useOrg() as Organization | null
  const course = useCourse() as Course | null
  const editorState = useEditorProvider() as EditorState
  const session = useLHSession() as Session

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const uploadZoneRef = React.useRef<HTMLDivElement>(null)

  const [blockObject, setBlockObject] = React.useState<AudioBlockObject | null>(
    node.attrs.blockObject?.source_type === 'upload' ? node.attrs.blockObject : null
  )
  const [selectedSize, setSelectedSize] = React.useState<AudioSize>(
    node.attrs.blockObject?.size || 'medium'
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)

  const isEditable = editorState?.isEditable
  const access_token = session?.data?.tokens?.access_token

  React.useEffect(() => {
    if (blockObject && blockObject.size !== selectedSize) {
      const newBlockObject = { ...blockObject, size: selectedSize }
      setBlockObject(newBlockObject)
      updateAttributes({ blockObject: newBlockObject })
    }
  }, [selectedSize])

  const handleAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setError(null)
      handleUpload(file)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === uploadZoneRef.current) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    const ext = file?.name.split('.').pop()?.toLowerCase()
    if (file && ext && ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      setError(null)
      handleUpload(file)
    } else {
      setError('Please upload a supported audio format (MP3, WAV, OGG, or M4A)')
    }
  }

  const handleUpload = async (file: File) => {
    if (!access_token) return
    try {
      setIsLoading(true)
      setError(null)
      setUploadProgress(0)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 200)
      const object = await uploadNewAudioFile(file, extension.options.activity.activity_uuid, access_token)
      clearInterval(progressInterval)
      setUploadProgress(100)
      const newBlockObject: AudioBlockObject = { ...object, source_type: 'upload', size: selectedSize }
      setBlockObject(newBlockObject)
      updateAttributes({ blockObject: newBlockObject })
      setTimeout(() => setUploadProgress(0), 1000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload audio. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = () => {
    setBlockObject(null)
    updateAttributes({ blockObject: null })
    setError(null)
    setUploadProgress(0)
  }

  const uploadAudioUrl =
    blockObject?.source_type === 'upload' && blockObject.content && org?.org_uuid && course?.courseStructure.course_uuid
      ? getAudioBlockStreamUrl(
          org.org_uuid,
          course.courseStructure.course_uuid,
          blockObject.content.activity_uuid || extension.options.activity.activity_uuid,
          blockObject.block_uuid || '',
          `${blockObject.content.file_id}.${blockObject.content.file_format}`
        )
      : null

  const getMaxWidth = (size: AudioSize) => {
    const mw = AUDIO_SIZES[size].maxWidth
    return typeof mw === 'number' ? mw : '100%'
  }

  if (!isEditable) {
    if (!blockObject || !uploadAudioUrl) return null
    const maxWidth = getMaxWidth(blockObject.size || 'medium')

    return (
      <NodeViewWrapper className="block-audio w-full">
        <div className="w-full flex justify-center my-4">
          <div style={{ maxWidth, width: '100%' }}>
            <InlineAudioPlayer src={uploadAudioUrl} />
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="block-audio w-full">
      <div className="bg-neutral-50 rounded-xl px-5 py-4 nice-shadow transition-all ease-linear">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Headphones className="text-neutral-400" size={16} />
            <span className="uppercase tracking-widest text-xs font-bold text-neutral-400">Audio</span>
          </div>
          {blockObject && (
            <button onClick={handleRemove} className="text-neutral-400 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {!blockObject && (
          <div className="space-y-4">
            <input ref={fileInputRef} type="file" onChange={handleAudioChange} accept={SUPPORTED_FILES} className="hidden" />
            <div
              ref={uploadZoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-neutral-200 bg-white hover:border-blue-400 hover:bg-blue-50/50'
              )}
            >
              {isLoading ? (
                <div className="space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="text-sm text-neutral-600">Uploading... {uploadProgress}%</p>
                  <div className="w-48 h-1 bg-neutral-200 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-8 h-8 mx-auto text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-700">Drop an audio file or click to browse</p>
                    <p className="text-xs text-neutral-500 mt-1">Supports MP3, WAV, OGG, M4A</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 font-medium bg-red-50 rounded-lg p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        )}

        {blockObject && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm text-neutral-500 font-medium flex items-center gap-1">
                <ArrowLeftRight size={14} />
                Size:
              </div>
              {(Object.keys(AUDIO_SIZES) as AudioSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors outline-none',
                    selectedSize === size
                      ? 'bg-neutral-700 text-white'
                      : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  )}
                >
                  {size === selectedSize && <CheckCircle2 size={14} />}
                  {AUDIO_SIZES[size].label}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <div style={{ maxWidth: getMaxWidth(selectedSize), width: '100%' }}>
                {uploadAudioUrl && <InlineAudioPlayer src={uploadAudioUrl} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default AudioBlockComponent
