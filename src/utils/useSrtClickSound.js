import { useCallback, useEffect, useRef } from "react";
import clickSoundFile from "../asset/Click.mp3";

export default function useSrtClickSound() {
  const audioRef = useRef(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  return useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(clickSoundFile);
      audioRef.current.volume = 1;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play()?.catch(() => {});
  }, []);
}
