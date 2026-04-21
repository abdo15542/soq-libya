import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/api';

const ProductDetail = ({ user, onBuy }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await api.get(`/products/${id}`);
      setProduct(res.data);
    } catch (err) {
      alert('المنتج غير موجود');
      navigate('/');
    }
    setLoading(false);
  };

  const handleBuy = () => {
    if (!user) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }
    onBuy(product);
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (!product) return null;

  return (
    <motion.div className="product-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <button className="back-btn" onClick={() => navigate(-1)}>← رجوع</button>
      <div className="product-detail-grid">
        <div className="images-section">
          <div className="main-image">
            <img src={product.images?.[selectedImage] || '/placeholder.png'} alt={product.name} />
          </div>
          {product.images?.length > 1 && (
            <div className="thumbnails">
              {product.images.map((img, idx) => (
                <img key={idx} src={img} className={idx === selectedImage ? 'active' : ''} onClick={() => setSelectedImage(idx)} />
              ))}
            </div>
          )}
        </div>
        <div className="info-section">
          <h1>{product.name}</h1>
          <p className="price">{product.price} د.ل</p>
          <p>البائع: {product.seller_name} ⭐ {product.seller_rating}</p>
          <p>{product.description}</p>
          <p>المخزون: {product.stock} قطعة</p>
          <button className="buy-btn primary" onClick={handleBuy}>شراء الآن</button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductDetail;