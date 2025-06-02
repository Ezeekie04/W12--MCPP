import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Button, Image, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import Geolocation from 'react-native-geolocation-service';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Konfigurasi notifikasi
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowList: true, 
  }),
});

const App = () => {
  const [uri, setUri] = useState("");
  const [coords, setCoords] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notification response:", response);
    });

    return () => {
      if (notificationListener.current)
        Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current)
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const openImagePicker = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
      },
      handleResponse
    );
  };

  const handleCameraLaunch = () => {
    launchCamera(
      {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
      },
      handleResponse
    );
  };

  const requestCameraPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "This app needs access to your camera to take photos.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        handleCameraLaunch();
      } else {
        console.log("Camera permission denied");
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleResponse = (response) => {
    if (response.didCancel) {
      console.log("User cancelled image picker");
    } else if (response.errorCode) {
      console.log("Image picker error: ", response.errorMessage);
    } else if (response.assets && response.assets.length > 0) {
      const imageUri = response.assets[0].uri;
      setUri(imageUri);
      saveFile(imageUri);
    }
  };

  const saveFile = async (imageUri) => {
    const path = RNFS.PicturesDirectoryPath + "/image_" + Date.now() + ".jpg";
    try {
      await RNFS.copyFile(imageUri, path);
      const location = await returnLocation();
      if (location) {
        await saveToFirestore(path, location);
      }
    } catch (error) {
      console.error("Error copying file:", error);
    }
  };

  const returnLocation = async () => {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) return null;

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords(position.coords);
          resolve({ latitude, longitude });
        },
        (error) => {
          console.error(`Location error (${error.code}): ${error.message}`);
          reject(error);
        },
        {
          accuracy: { android: "high" },
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
          distanceFilter: 0,
          forceRequestLocation: true,
          forceLocationManager: true,
          showLocationDialog: true,
        }
      );
    });
  };

  const getLocation = async () => {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) return;

    Geolocation.getCurrentPosition(
      async (position) => {
        setCoords(position.coords);
        console.log(position);
        await saveLocation(position.coords);
      },
      (error) => {
        console.error("Code ${error.code}", error.message);
      },
      {
        accuracy: { android: "high" },
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        distanceFilter: 0,
        forceRequestLocation: true,
        forceLocationManager: true,
        showLocationDialog: true,
      }
    );
  };

  const hasLocationPermission = async () => {
    if (Platform.OS === "android" && Platform.Version < 23) return true;

    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    if (hasPermission) return true;

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    return status === PermissionsAndroid.RESULTS.GRANTED;
  };

  const saveLocation = async (coords) => {
    const path = RNFS.DownloadDirectoryPath + "/location_" + Date.now() + ".txt";
    const data = `Longitude: ${coords.longitude}\nLatitude: ${coords.latitude}`;
    try {
      await RNFS.writeFile(path, data, 'utf8');
      console.log("Location saved to:", path);
    } catch (err) {
      console.error(err);
    }
  };

  const saveToFirestore = async (imagePath, location) => {
    try {
      await addDoc(collection(db, "photo_logs"), {
        imagePath,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: serverTimestamp(),
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "✅ Data berhasil disimpan",
          body: `Lokasi: ${location.latitude}, ${location.longitude}`,
        },
        trigger: null,
      });

      console.log("Data saved to Firestore");
    } catch (error) {
      console.error("Error saving to Firestore:", error);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "❌ Gagal menyimpan data",
          body: `Lokasi: ${location.latitude}, ${location.longitude}`,
        },
        trigger: null,
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text>Adrianus Ezeekiel - 00000071229</Text>
      <Text style={{ marginVertical: 10 }}>Push Token: {expoPushToken}</Text>
      {coords && (
        <>
          <Text>Longitude: {coords.longitude}</Text>
          <Text>Latitude: {coords.latitude}</Text>
        </>
      )}
      <Button title="Open Camera" onPress={requestCameraPermission} />
      <Button title="Open Gallery" onPress={openImagePicker} />
      <Button title="Get Geo Location" onPress={getLocation} />
      {uri ? (
        <Image source={{ uri }} style={{ width: 200, height: 200, marginTop: 20 }} />
      ) : null}
    </View>
  );
};

const registerForPushNotificationsAsync = async () => {
  let token;
  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo push token:', token);
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
