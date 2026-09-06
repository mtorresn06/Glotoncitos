/** Paleta cálida inspirada en el mockup de diseño de Glotoncitos */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        crema: '#FBE9D9',
        durazno: '#F4D4B8',
        cafe: {
          DEFAULT: '#7A5C3E',
          oscuro: '#4A3826',
        },
        libre: '#7CB98B',
        ocupada: '#E0895F',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
