import { useEffect, useState, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastKnownHeight = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height ?? 0;
      console.log('🔼 keyboard show', height);
      if (height > 0) {
        lastKnownHeight.current = height;
        setKeyboardHeight(height);
      } else if (lastKnownHeight.current > 0) {
        console.log('⚠️ altura 0 ignorada, usando fallback:', lastKnownHeight.current);
        setKeyboardHeight(lastKnownHeight.current);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      console.log('🔽 keyboard hide')
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}
