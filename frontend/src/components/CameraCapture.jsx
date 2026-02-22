import { useEffect, useRef, useState } from 'react'
import { Camera, X, Check, RefreshCw, AlertCircle } from 'lucide-react'

export default function CameraCapture({ onCapture, onClose }) {
    const videoRef = useRef(null)
    const [stream, setStream] = useState(null)
    const [permissionState, setPermissionState] = useState('prompt') // 'prompt', 'granted', 'denied'
    const [error, setError] = useState(null)

    // modes: 'idle', 'recording', 'review_photo', 'review_video'
    const [mode, setMode] = useState('idle')
    const [mediaType, setMediaType] = useState('photo') // 'photo' | 'video'
    const [capturedFile, setCapturedFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)

    const mediaRecorderRef = useRef(null)
    const chunksRef = useRef([])

    useEffect(() => {
        let activeStream = null
        async function startCamera() {
            try {
                // First attempt to request permission to see if it's already denied, etc.
                const nav = navigator.permissions
                if (nav) {
                    try {
                        const res = await nav.query({ name: 'camera' })
                        if (res.state === 'denied') {
                            setPermissionState('denied')
                            return
                        }
                    } catch (e) { /* ignore */ }
                }

                let s;
                try {
                    s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
                } catch (e) {
                    s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                }
                activeStream = s
                setStream(s)
                setPermissionState('granted')
                if (videoRef.current) {
                    videoRef.current.srcObject = s
                }
            } catch (err) {
                setPermissionState('denied')
                setError('Camera access denied. Please allow camera permissions in your browser settings.')
            }
        }
        startCamera()
        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    function handleTakePhoto() {
        if (!videoRef.current) return
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
                setCapturedFile(file)
                setPreviewUrl(URL.createObjectURL(blob))
                setMode('review_photo')
            }
        }, 'image/jpeg', 0.9)
    }

    function handleStartRecording() {
        if (!stream) return
        chunksRef.current = []

        let options = { mimeType: 'video/webm;codecs=vp8,opus' }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm' }
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/mp4' }
            }
        }

        let recorder
        try {
            recorder = new MediaRecorder(stream, options)
        } catch (e) {
            console.error('MediaRecorder init failed', e)
            try {
                recorder = new MediaRecorder(stream)
            } catch (e2) {
                console.error('Fallback MediaRecorder init failed', e2)
                return
            }
        }

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = () => {
            const actualMimeType = recorder.mimeType || 'video/webm'
            const baseMimeType = actualMimeType.split(';')[0]
            const blob = new Blob(chunksRef.current, { type: baseMimeType })
            const ext = baseMimeType.includes('mp4') ? 'mp4' : 'webm'
            const file = new File([blob], `video-${Date.now()}.${ext}`, { type: baseMimeType })

            console.log("Recorded video blob size:", blob.size, "type:", blob.type)

            setCapturedFile(file)
            setPreviewUrl(URL.createObjectURL(blob))
            setMode('review_video')
        }

        recorder.start(200) // request data every 200ms
        mediaRecorderRef.current = recorder
        setMode('recording')
    }

    function handleStopRecording() {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
        }
    }

    function handleRetake() {
        setCapturedFile(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setMode('idle')
        // Re-attach stream to video element
        setTimeout(() => {
            if (videoRef.current && stream) {
                videoRef.current.srcObject = stream
            }
        }, 50)
    }

    function handleConfirm() {
        if (capturedFile) {
            onCapture(capturedFile)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="relative w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-base" style={{ background: 'var(--color-surface)' }}>
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-base">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Camera</h2>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6 flex flex-col items-center">
                    {permissionState === 'prompt' ? (
                        <div className="flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl" style={{ border: '8px solid var(--color-surface-2)', background: 'black' }}>
                            <Camera size={48} className="mb-4 animate-pulse" style={{ color: 'var(--color-text-muted)' }} />
                            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Allow Camera Access</h3>
                            <p className="text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>We need your permission to take photos and videos.</p>
                        </div>
                    ) : permissionState === 'denied' ? (
                        <div className="flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl" style={{ border: '8px solid var(--color-surface-2)', background: 'black' }}>
                            <AlertCircle size={48} className="mb-4 text-red-500" />
                            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Access Denied</h3>
                            <p className="text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{error || 'Please enable camera permissions in your browser settings to continue.'}</p>
                        </div>
                    ) : mode.startsWith('review') ? (
                        <div className="w-full flex-col flex items-center gap-6">
                            {/* Camera Viewport with thick border */}
                            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black flex items-center justify-center" style={{ border: '8px solid var(--color-surface-2)' }}>
                                {mode === 'review_photo' ? (
                                    <img src={previewUrl} className="w-full h-full object-contain" alt="Captured" />
                                ) : (
                                    <video key={previewUrl} src={previewUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
                                )}
                            </div>
                            {/* Controls */}
                            <div className="flex gap-4 w-full justify-center">
                                <button onClick={handleRetake} className="px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                                    <RefreshCw size={18} /> Retake
                                </button>
                                <button onClick={handleConfirm} className="px-8 py-3 rounded-xl font-semibold transition-colors shadow-lg flex items-center gap-2 hover:opacity-90 active:scale-95" style={{ background: 'var(--color-accent)', color: 'white' }}>
                                    <Check size={20} /> Use {mode === 'review_photo' ? 'Photo' : 'Video'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full flex-col flex items-center gap-6 relative">
                            {/* Live Viewport with thick border and integrated controls */}
                            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black flex flex-col" style={{ border: '8px solid var(--color-surface-2)' }}>
                                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

                                {mode === 'recording' && (
                                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full z-20" style={{ background: 'rgba(0,0,0,0.6)' }}>
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-white text-xs font-semibold tracking-wider">REC</span>
                                    </div>
                                )}

                                {/* Bottom Controls Area Overlay */}
                                <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col items-center gap-4 z-20" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
                                    {/* Shutter Button */}
                                    {mode === 'recording' ? (
                                        <button onClick={handleStopRecording} className="w-16 h-16 rounded-full border-[4px] p-1 flex items-center justify-center transition-transform hover:scale-105" style={{ borderColor: 'var(--color-accent)' }}>
                                            <div className="w-6 h-6 rounded-sm animate-pulse" style={{ background: 'var(--color-accent)' }} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={mediaType === 'photo' ? handleTakePhoto : handleStartRecording}
                                            className="w-16 h-16 rounded-full border-[4px] p-1 flex items-center justify-center transition-transform hover:scale-105 bg-black/20 backdrop-blur-sm" style={{ borderColor: 'var(--color-accent)' }}
                                        >
                                            <div className="w-full h-full rounded-full transition-colors" style={{ background: mediaType === 'photo' ? 'white' : 'var(--color-accent)' }} />
                                        </button>
                                    )}

                                    {/* Slider Switcher similar to Create/Join */}
                                    {mode === 'idle' && (
                                        <div className="relative flex rounded-md p-0.5 bg-black/40 backdrop-blur-md" style={{ width: '180px' }}>
                                            <div
                                                className="absolute top-0.5 bottom-0.5 rounded shadow-sm transition-all duration-300 ease-out"
                                                style={{
                                                    width: 'calc(50% - 0.125rem)',
                                                    left: mediaType === 'video' ? 'calc(50% + 0.125rem)' : '0.125rem',
                                                    background: 'var(--color-accent)'
                                                }}
                                            />
                                            <button type="button"
                                                onClick={() => setMediaType('photo')}
                                                className={`flex-1 relative z-10 text-sm py-1.5 rounded transition-all font-medium outline-none ${mediaType === 'photo' ? 'text-white' : 'text-white/70 hover:text-white'}`}>
                                                Photo
                                            </button>
                                            <button type="button"
                                                onClick={() => setMediaType('video')}
                                                className={`flex-1 relative z-10 text-sm py-1.5 rounded transition-all font-medium outline-none ${mediaType === 'video' ? 'text-white' : 'text-white/70 hover:text-white'}`}>
                                                Video
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
