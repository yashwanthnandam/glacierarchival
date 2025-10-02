import React, { useState } from 'react';
import { TextField, Button, Card, CardContent } from '@mui/material';

const Register = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // handle registration logic
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <TextField name="username" label="Username" value={formData.username} onChange={handleChange} required />
          <TextField name="email" label="Email" value={formData.email} onChange={handleChange} required />
          <TextField name="password" type="password" label="Password" value={formData.password} onChange={handleChange} required />
          <Button type="submit">Register</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default Register;