import { describe, expect, it, vi } from 'vitest';
import { notifyPageContact } from './page-contact';
import { PAGE_CONTACT_MESSAGE } from './protocol';

describe('notifyPageContact', () => {
  it('sends the page-contact message and nothing about the page', async () => {
    const sendMessage = vi.fn(async () => undefined);
    await notifyPageContact({ runtime: { sendMessage } });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(PAGE_CONTACT_MESSAGE);
  });

  it('swallows a failure to reach the background page', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('Receiving end does not exist.');
    });
    await expect(notifyPageContact({ runtime: { sendMessage } })).resolves.toBeUndefined();
  });
});
