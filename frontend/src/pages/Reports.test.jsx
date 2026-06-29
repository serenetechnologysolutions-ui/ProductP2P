import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '../api/axios';
import Reports from './Reports';

jest.mock('../api/axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../contexts/FeatureFlagsContext', () => ({ useFeatureFlag: () => true }));

const REPORT_TYPES = [
  {
    key: 'purchase_requisitions',
    label: 'Purchase Requisitions',
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'approved'] },
      { key: 'value_range', label: 'Total Value', type: 'value_range' },
    ],
    columns: [
      { key: 'pr_number', label: 'PR Number' },
      { key: 'status', label: 'Status' },
    ],
  },
];

describe('Reports page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/reports/types') return Promise.resolve({ data: { data: REPORT_TYPES } });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
  });

  it('loads report types on mount and selects the first one by default', async () => {
    render(<Reports />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/types'));
    expect(await screen.findAllByText('Purchase Requisitions')).not.toHaveLength(0);
  });

  it('renders the declared filter for the selected report (Status select)', async () => {
    render(<Reports />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/types'));
    // "Status" appears as both the filter's own label and the Select's placeholder.
    await waitFor(() => expect(screen.getAllByText('Status').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Total Value').length).toBeGreaterThan(0);
  });

  it('calls the preview endpoint with the selected filters when "View Report" is clicked', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/reports/types') return Promise.resolve({ data: { data: REPORT_TYPES } });
      if (url === '/reports/purchase_requisitions/preview') {
        return Promise.resolve({ data: { data: [{ pr_number: 'PR-000001', status: 'approved' }], columns: REPORT_TYPES[0].columns } });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<Reports />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/types'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /view report/i }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/purchase_requisitions/preview', expect.anything()));
    expect(await screen.findByText('PR-000001')).toBeInTheDocument();
  });

  it('shows the empty-state prompt before any report has been run', async () => {
    render(<Reports />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/types'));
    expect(await screen.findByText(/click.*view report.*to preview/i)).toBeInTheDocument();
  });
});
