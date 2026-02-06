"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface JudgePanelProps {
  challongeId: string;
  onLogout: () => void;
}

interface Match {
  id: string;
  player1: string;
  player2: string;
  winner?: string;
  scores: {
    player1: number;
    player2: number;
  };
  status: 'pending' | 'completed';
  timestamp?: number;
}

export default function JudgePanel({ challongeId, onLogout }: JudgePanelProps) {
  const [activeTab, setActiveTab] = useState<'scanner' | 'scoring' | 'matches'>('scanner');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [scannerActive, setScannerActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadMatches = useCallback(() => {
    const savedMatches = localStorage.getItem(`matches_${challongeId}`);
    if (savedMatches) {
      setMatches(JSON.parse(savedMatches));
    } else {
      // Initialize with some sample matches
      const sampleMatches: Match[] = [
        {
          id: '1',
          player1: 'Player A',
          player2: 'Player B',
          scores: { player1: 0, player2: 0 },
          status: 'pending'
        },
        {
          id: '2',
          player1: 'Player C',
          player2: 'Player D',
          scores: { player1: 0, player2: 0 },
          status: 'pending'
        }
      ];
      setMatches(sampleMatches);
      localStorage.setItem(`matches_${challongeId}`, JSON.stringify(sampleMatches));
    }
  }, [challongeId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScannerActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopScanner = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
  };

  const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number) => {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  };

  const downscaleCanvas = (canvas: HTMLCanvasElement, scale: number) => {
    const nextCanvas = document.createElement('canvas');
    const nextWidth = Math.max(1, Math.round(canvas.width * scale));
    const nextHeight = Math.max(1, Math.round(canvas.height * scale));
    nextCanvas.width = nextWidth;
    nextCanvas.height = nextHeight;
    const ctx = nextCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, nextWidth, nextHeight);
    }
    return nextCanvas;
  };

  const captureScreenshot = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);

        const targetBytes = 150 * 1024;
        const saveBlob = (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `match-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        const compressAndSave = async () => {
          let workingCanvas = canvas;
          let quality = 0.85;
          let lastBlob: Blob | null = null;

          for (let attempt = 0; attempt < 6; attempt += 1) {
            const blob = await canvasToJpegBlob(workingCanvas, quality);
            if (!blob) return;
            lastBlob = blob;
            if (blob.size <= targetBytes) {
              saveBlob(blob);
              return;
            }

            if (quality > 0.55) {
              quality = Math.max(0.5, quality - 0.1);
              continue;
            }

            const scale = Math.max(0.5, Math.sqrt(targetBytes / blob.size) * 0.9);
            workingCanvas = downscaleCanvas(workingCanvas, scale);
            quality = 0.75;
          }

          if (lastBlob) {
            saveBlob(lastBlob);
          }
        };

        void compressAndSave();
      }
    }
  };

  const selectMatch = (match: Match) => {
    setCurrentMatch(match);
    setPlayer1Score(match.scores.player1);
    setPlayer2Score(match.scores.player2);
    setActiveTab('scoring');
  };

  const submitScore = () => {
    if (!currentMatch) return;

    const winner = player1Score > player2Score ? currentMatch.player1 : currentMatch.player2;
    
    const updatedMatch: Match = {
      ...currentMatch,
      scores: {
        player1: player1Score,
        player2: player2Score
      },
      winner,
      status: 'completed',
      timestamp: Date.now()
    };

    const updatedMatches = matches.map(match => 
      match.id === currentMatch.id ? updatedMatch : match
    );

    setMatches(updatedMatches);
    localStorage.setItem(`matches_${challongeId}`, JSON.stringify(updatedMatches));
    
    alert(`Score submitted! Winner: ${winner}`);
    setCurrentMatch(null);
    setPlayer1Score(0);
    setPlayer2Score(0);
  };

  const createNewMatch = () => {
    const player1 = prompt('Enter Player 1 name:');
    const player2 = prompt('Enter Player 2 name:');
    
    if (player1 && player2) {
      const newMatch: Match = {
        id: Date.now().toString(),
        player1: player1.trim(),
        player2: player2.trim(),
        scores: { player1: 0, player2: 0 },
        status: 'pending'
      };

      const updatedMatches = [...matches, newMatch];
      setMatches(updatedMatches);
      localStorage.setItem(`matches_${challongeId}`, JSON.stringify(updatedMatches));
    }
  };

  return (
    <main className="xzvl-theme min-h-screen">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm shadow-lg border-b border-red-500/30">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
          <div className="flex items-center space-x-4">
            <div className="xzvl-logo w-12 h-12 text-lg">
              XZVL
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Judge Panel</h1>
              <p className="text-red-300">Tournament: {challongeId}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="xzvl-btn-primary"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="xzvl-card mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-6 py-4 font-medium transition-all ${
                activeTab === 'scanner'
                  ? 'border-b-3 border-red-500 text-red-600 bg-red-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📱 QR Scanner
            </button>
            <button
              onClick={() => setActiveTab('scoring')}
              className={`px-6 py-4 font-medium transition-all ${
                activeTab === 'scoring'
                  ? 'border-b-3 border-red-500 text-red-600 bg-red-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              ⚔️ Match Scoring
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`px-6 py-4 font-medium transition-all ${
                activeTab === 'matches'
                  ? 'border-b-3 border-red-500 text-red-600 bg-red-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              🏆 Match Management
            </button>
          </div>

          <div className="p-6">
            {/* QR Scanner Tab */}
            {activeTab === 'scanner' && (
              <div className="space-y-6 p-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-4 text-red-600">📱 QR Code Scanner</h2>
                  
                  {!scannerActive ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 rounded-xl text-white">
                        <p className="mb-4 text-lg">Ready to scan QR codes for match verification</p>
                        <button
                          onClick={startScanner}
                          className="bg-white text-green-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-all transform hover:scale-105"
                        >
                          🎥 Start Camera
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="relative max-w-lg mx-auto">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full rounded-xl border-4 border-red-300 shadow-2xl"
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-xl pointer-events-none"></div>
                      </div>
                      
                      <div className="flex justify-center space-x-4">
                        <button
                          onClick={captureScreenshot}
                          className="bg-blue-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-600 transition-all transform hover:scale-105 flex items-center space-x-2"
                        >
                          <span>📸</span>
                          <span>Capture Screenshot</span>
                        </button>
                        <button
                          onClick={stopScanner}
                          className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-600 transition-all transform hover:scale-105 flex items-center space-x-2"
                        >
                          <span>🛑</span>
                          <span>Stop Camera</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Match Scoring Tab */}
            {activeTab === 'scoring' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">Match Scoring</h2>
                
                {currentMatch ? (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {currentMatch.player1} vs {currentMatch.player2}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="text-center">
                        <h4 className="font-medium text-lg mb-2">{currentMatch.player1}</h4>
                        <div className="flex items-center justify-center space-x-4">
                          <button
                            onClick={() => setPlayer1Score(Math.max(0, player1Score - 1))}
                            className="bg-red-500 text-white w-10 h-10 rounded-full hover:bg-red-600"
                          >
                            -
                          </button>
                          <span className="text-3xl font-bold w-16 text-center">{player1Score}</span>
                          <button
                            onClick={() => setPlayer1Score(player1Score + 1)}
                            className="bg-green-500 text-white w-10 h-10 rounded-full hover:bg-green-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <h4 className="font-medium text-lg mb-2">{currentMatch.player2}</h4>
                        <div className="flex items-center justify-center space-x-4">
                          <button
                            onClick={() => setPlayer2Score(Math.max(0, player2Score - 1))}
                            className="bg-red-500 text-white w-10 h-10 rounded-full hover:bg-red-600"
                          >
                            -
                          </button>
                          <span className="text-3xl font-bold w-16 text-center">{player2Score}</span>
                          <button
                            onClick={() => setPlayer2Score(player2Score + 1)}
                            className="bg-green-500 text-white w-10 h-10 rounded-full hover:bg-green-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 text-center">
                      <button
                        onClick={submitScore}
                        className="bg-blue-500 text-white px-8 py-3 rounded-md hover:bg-blue-600 transition duration-200 mr-4"
                      >
                        Submit Score
                      </button>
                      <button
                        onClick={() => setCurrentMatch(null)}
                        className="bg-gray-500 text-white px-8 py-3 rounded-md hover:bg-gray-600 transition duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Select a match from the Match Management tab to score it.</p>
                  </div>
                )}
              </div>
            )}

            {/* Match Management Tab */}
            {activeTab === 'matches' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Match Management</h2>
                  <button
                    onClick={createNewMatch}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-200"
                  >
                    Create New Match
                  </button>
                </div>
                
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className={`border rounded-lg p-4 ${
                        match.status === 'completed'
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {match.player1} vs {match.player2}
                          </h4>
                          {match.status === 'completed' && (
                            <p className="text-sm text-gray-600">
                              Score: {match.scores.player1} - {match.scores.player2}
                              <span className="ml-2 font-semibold">
                                Winner: {match.winner}
                              </span>
                            </p>
                          )}
                          {match.timestamp && (
                            <p className="text-xs text-gray-500">
                              {new Date(match.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="space-x-2">
                          {match.status === 'pending' && (
                            <button
                              onClick={() => selectMatch(match)}
                              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-200"
                            >
                              Score Match
                            </button>
                          )}
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            match.status === 'completed'
                              ? 'bg-green-200 text-green-800'
                              : 'bg-yellow-200 text-yellow-800'
                          }`}>
                            {match.status === 'completed' ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}