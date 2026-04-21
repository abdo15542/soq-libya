import React, { useState } from 'react';

const ProductForm = ({ product, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: product.name || '',
    description: product.description || '',
    price: product.price || '',
    category: product.category || '',
    city: product.city || '',
    stock: product.stock || 1,
  });
  const [images, setImages] = useState([]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(product.id, { ...form, images });
  };

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <input name="name" placeholder="اسم المنتج" value={form.name} onChange={handleChange} required />
      <textarea name="description" placeholder="الوصف" value={form.description} onChange={handleChange} />
      <input name="price" type="number" placeholder="السعر" value={form.price} onChange={handleChange} required />
      <input name="category" placeholder="الفئة" value={form.category} onChange={handleChange} />
      <input name="city" placeholder="المدينة" value={form.city} onChange={handleChange} />
      <input name="stock" type="number" placeholder="الكمية" value={form.stock} onChange={handleChange} />
      <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files))} />
      <button type="submit">حفظ</button>
      <button type="button" onClick={onCancel}>إلغاء</button>
    </form>
  );
};

export default ProductForm;