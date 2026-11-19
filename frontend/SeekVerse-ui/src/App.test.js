import { render, screen } from '@testing-library/react';
import { Auth0Provider } from './AuthContext';
import App from './App';

test('renders SeekVerse heading', () => {
  render(
    <Auth0Provider>
      <App />
    </Auth0Provider>
  );
  const headingElement = screen.getByText(/SeekVerse/i);
  expect(headingElement).toBeInTheDocument();
});
