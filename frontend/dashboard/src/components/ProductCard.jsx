import React from 'react';
import { motion } from 'framer-motion';

const ProductCard = ({ product, onBuy, onView }) => {
  return (
    <motion.div
      className="product-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onView && onView(product.id)}
    >
      <img src={product.images?.[0] || '/placeholder.png'} alt={product.name} />
      <div className="product-info">
        <h4>{product.name}</h4>
        <p className="price">{product.price} د.ل</p>
        <p className="seller">البائع: {product.seller_name}</p>
        <p className="city">📍 {product.city || 'طرابلس'}</p>
        <button onClick={(e) => { e.stopPropagation(); onBuy(product); }}>شراء الآن</button>
      </div>
    </motion.div>
  );
};

export default ProductCard;