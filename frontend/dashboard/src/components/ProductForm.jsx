import React, { useState } from 'react';

const ProductForm = ({ product, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ?? '',
    category: product?.category || '',
    city: product?.city || '',
    stock: product?.stock ?? 1,
  });
  const [images, setImages] = useState([]);

  const handleChange = (e) => {
    setForm((previous) => ({ ...previous, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim() || !Number.isFinite(price) || price <= 0 ||
        !Number.isInteger(stock) || stock < 0) return;
    onSave(product?.id ?? null, { ...form, name: form.name.trim(), price, stock, images });
  };

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <input name="name" placeholder="اسم المنتج" value={form.name} onChange={handleChange} required maxLength={255} />
      <textarea name="description" placeholder="الوصف" value={form.description} onChange={handleChange} maxLength={5000} />
      <input name="price" type="number" min="0.01" step="0.01" placeholder="السعر بالدينار الليبي" value={form.price} onChange={handleChange} required />
      <input name="category" placeholder="الفئة" value={form.category} onChange={handleChange} maxLength={50} />
      <input name="city" placeholder="المدينة" value={form.city} onChange={handleChange} maxLength={50} />
      <input name="stock" type="number" min="0" step="1" placeholder="الكمية" value={form.stock} onChange={handleChange} required />
      <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files || []))} />
      <button type="submit" disabled={!form.name.trim() || !Number.isFinite(Number(form.price)) || Number(form.price) <= 0 || !Number.isInteger(Number(form.stock)) || Number(form.stock) < 0}>
        {product?.id ? 'حفظ التعديلات' : 'إضافة المنتج'}
      </button>
      <button type="button" onClick={onCancel}>إلغاء</button>
    </form>
  );
};

export default ProductForm;
