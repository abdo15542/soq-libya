import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center]);
  return null;
};

const DriverTracker = ({ driverId }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res = await api.get(`/location/driver/${driverId}`);
        if (res.data) setLocation([res.data.latitude, res.data.longitude]);
      } catch (err) {
        console.error('خطأ في جلب الموقع');
      }
      setLoading(false);
    };
    fetchLocation();
    const interval = setInterval(fetchLocation, 10000);
    return () => clearInterval(interval);
  }, [driverId]);

  if (loading) return <div className="map-placeholder">جاري تحميل الخريطة...</div>;
  if (!location) return <div className="map-placeholder">موقع المندوب غير متاح</div>;

  return (
    <div className="driver-tracker">
      <h4>تتبع المندوب مباشرة</h4>
      <MapContainer center={location} zoom={13} style={{ height: '250px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={location}>
          <Popup>المندوب في طريقه إليك</Popup>
        </Marker>
        <MapUpdater center={location} />
      </MapContainer>
    </div>
  );
};

export default DriverTracker;