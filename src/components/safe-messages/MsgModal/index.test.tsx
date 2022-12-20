import { hexlify, hexZeroPad, toUtf8Bytes } from 'ethers/lib/utils'
import { Web3Provider } from '@ethersproject/providers'
import type { SafeInfo, SafeMessage } from '@gnosis.pm/safe-react-gateway-sdk'

import MsgModal from '@/components/safe-messages/MsgModal'
import * as useIsWrongChainHook from '@/hooks/useIsWrongChain'
import * as useIsSafeOwnerHook from '@/hooks/useIsSafeOwner'
import * as useWalletHook from '@/hooks/wallets/useWallet'
import * as useSafeInfoHook from '@/hooks/useSafeInfo'
import * as useAsyncHook from '@/hooks/useAsync'
import * as sender from '@/services/safe-messages/safeMsgSender'
import * as web3 from '@/hooks/wallets/web3'
import { render, act, fireEvent, waitFor } from '@/tests/test-utils'
import type { ConnectedWallet } from '@/hooks/wallets/useOnboard'

jest.mock('@gnosis.pm/safe-react-gateway-sdk', () => ({
  ...jest.requireActual('@gnosis.pm/safe-react-gateway-sdk'),
  getSafeMessage: jest.fn(),
}))

const mockProvider: Web3Provider = new Web3Provider(jest.fn())

describe('MsgModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(useSafeInfoHook, 'default').mockImplementation(() => ({
      safe: {
        address: {
          value: hexZeroPad('0x1', 20),
        },
        chainId: '5',
      } as SafeInfo,
      safeAddress: hexZeroPad('0x1', 20),
      safeError: undefined,
      safeLoading: false,
      safeLoaded: true,
    }))
  })

  it('renders the message hash', () => {
    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        messageHash="0x123"
        onClose={jest.fn}
      />,
    )

    expect(getByText('0x123')).toBeInTheDocument()
  })

  describe('EIP-191 messages', () => {
    const EXAMPLE_MESSAGE = 'Hello world!'

    it('renders the (decoded) message', () => {
      const { getByText } = render(
        <MsgModal
          requestId="123"
          logoUri="www.fake.com/test.png"
          name="Test App"
          message={hexlify(toUtf8Bytes(EXAMPLE_MESSAGE))}
          onClose={jest.fn}
        />,
      )

      expect(getByText(EXAMPLE_MESSAGE)).toBeInTheDocument()
    })

    it('displays the SafeMessage message', () => {
      const { getByText } = render(
        <MsgModal
          logoUri="www.fake.com/test.png"
          name="Test App"
          message={EXAMPLE_MESSAGE}
          requestId="123"
          onClose={jest.fn}
        />,
      )

      expect(getByText('0xaa05af77f274774b8bdc7b61d98bc40da523dc2821fdea555f4d6aa413199bcc')).toBeInTheDocument()
    })

    it('generates the SafeMessage hash if not provided', () => {
      const { getByText } = render(
        <MsgModal
          logoUri="www.fake.com/test.png"
          name="Test App"
          message={EXAMPLE_MESSAGE}
          requestId="123"
          onClose={jest.fn}
        />,
      )

      expect(getByText('0x73d0948ac608c5d00a6dd26dd396cce79b459307ea365f5a5bd5d3119c2d9708')).toBeInTheDocument()
    })
  })

  describe('EIP-712 messages', () => {
    const EXAMPLE_MESSAGE = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'account', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      },
      primaryType: 'Mail',
      domain: {
        name: 'EIP-1271 Example',
        version: '1.0',
        chainId: 5,
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      message: {
        from: {
          name: 'Alice',
          account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
        to: {
          name: 'Bob',
          account: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
        contents: 'Hello EIP-1271!',
      },
    }

    it('renders the message', () => {
      const { getByText } = render(
        <MsgModal
          requestId="123"
          logoUri="www.fake.com/test.png"
          name="Test App"
          message={EXAMPLE_MESSAGE}
          onClose={jest.fn}
        />,
      )

      Object.keys(EXAMPLE_MESSAGE.types).forEach((key) => {
        expect(getByText(key, { exact: false })).toBeInTheDocument()
      })

      expect(getByText('Hello EIP-1271!', { exact: false })).toBeInTheDocument()
    })

    it('displays the SafeMessage message', () => {
      const { getByText } = render(
        <MsgModal
          logoUri="www.fake.com/test.png"
          name="Test App"
          message={EXAMPLE_MESSAGE}
          requestId="123"
          onClose={jest.fn}
        />,
      )

      expect(getByText('0xd5ffe9f6faa9cc9294673fb161b1c7b3e0c98241e90a38fc6c451941f577fb19')).toBeInTheDocument()
    })

    it('generates the SafeMessage hash if not provided', () => {
      const { getByText } = render(
        <MsgModal
          logoUri="www.fake.com/test.png"
          name="Test App"
          message={EXAMPLE_MESSAGE}
          requestId="123"
          onClose={jest.fn}
        />,
      )

      expect(getByText('0x10c926c4f417e445de3fddc7ad8c864f81b9c81881b88eba646015de10d21613')).toBeInTheDocument()
    })
  })

  it('proposes a message if not already proposed', async () => {
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => false)
    jest.spyOn(useIsSafeOwnerHook, 'default').mockImplementation(() => true)
    jest.spyOn(web3, 'useWeb3').mockReturnValue(mockProvider)

    jest.spyOn(useAsyncHook, 'default').mockReturnValue([undefined, new Error('SafeMessage not found'), false])

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    const proposalSpy = jest.spyOn(sender, 'dispatchSafeMsgProposal')

    const button = getByText('Sign')

    await act(() => {
      fireEvent.click(button)
    })

    expect(proposalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        safe: {
          address: {
            value: hexZeroPad('0x1', 20),
          },
          chainId: '5',
        } as SafeInfo,
        message: 'Hello world!',
        requestId: '123',
        safeAppId: 25,
      }),
    )
  })

  it('confirms the message if already proposed', async () => {
    jest.spyOn(web3, 'useWeb3').mockReturnValue(mockProvider)
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => false)
    jest.spyOn(useIsSafeOwnerHook, 'default').mockImplementation(() => true)
    jest.spyOn(useWalletHook, 'default').mockImplementation(
      () =>
        ({
          address: hexZeroPad('0x2', 20),
        } as ConnectedWallet),
    )

    jest
      .spyOn(useAsyncHook, 'default')
      .mockReturnValue([
        { confirmations: [] as SafeMessage['confirmations'] } as SafeMessage,
        new Error('SafeMessage not found'),
        false,
      ])

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        messageHash="0x123"
        requestId="123"
        onClose={jest.fn}
      />,
    )

    await act(async () => {
      Promise.resolve()
    })

    const confirmationSpy = jest.spyOn(sender, 'dispatchSafeMsgConfirmation')

    const button = getByText('Sign')

    await act(() => {
      fireEvent.click(button)
    })

    expect(confirmationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        safe: {
          address: {
            value: hexZeroPad('0x1', 20),
          },
          chainId: '5',
        } as SafeInfo,
        message: 'Hello world!',
        requestId: '123',
      }),
    )
  })

  it('displays an error if connected to the wrong chain', () => {
    jest.spyOn(web3, 'useWeb3').mockReturnValue(undefined)

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    expect(getByText('No wallet is connected.')).toBeInTheDocument()

    expect(getByText('Sign')).toBeDisabled()
  })

  it('displays an error if connected to the wrong chain', () => {
    jest.spyOn(web3, 'useWeb3').mockReturnValue(mockProvider)
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => true)

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    expect(getByText('Your wallet is connected to the wrong chain.')).toBeInTheDocument()

    expect(getByText('Sign')).toBeDisabled()
  })

  it('displays an error if not an owner', () => {
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => false)
    jest.spyOn(useIsSafeOwnerHook, 'default').mockImplementation(() => false)

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    expect(
      getByText("You are currently not an owner of this Safe and won't be able to confirm this message."),
    ).toBeInTheDocument()

    expect(getByText('Sign')).toBeDisabled()
  })

  it('displays an error if the message has already been signed', async () => {
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => false)
    jest.spyOn(useIsSafeOwnerHook, 'default').mockImplementation(() => true)
    jest.spyOn(useWalletHook, 'default').mockImplementation(
      () =>
        ({
          address: hexZeroPad('0x2', 20),
        } as ConnectedWallet),
    )

    jest.spyOn(useAsyncHook, 'default').mockReturnValue([
      {
        confirmations: [
          {
            owner: {
              value: hexZeroPad('0x2', 20),
            },
          },
        ],
      } as SafeMessage,
      new Error('SafeMessage not found'),
      false,
    ])

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    await waitFor(() => {
      expect(getByText('Your connected wallet has already signed this message.')).toBeInTheDocument()

      expect(getByText('Sign')).toBeDisabled()
    })
  })

  it('displays an error if the message could not be proposed', async () => {
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => false)
    jest.spyOn(useIsSafeOwnerHook, 'default').mockImplementation(() => true)

    jest.spyOn(useAsyncHook, 'default').mockReturnValue([undefined, new Error('SafeMessage not found'), false])

    const proposalSpy = jest
      .spyOn(sender, 'dispatchSafeMsgProposal')
      .mockImplementation(() => Promise.reject(new Error('Test error')))

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    const button = getByText('Sign')

    await act(() => {
      fireEvent.click(button)
    })

    expect(proposalSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(getByText('Error confirming the message. Please try again.')).toBeInTheDocument()
    })
  })

  it('displays an error if the message could not be confirmed', async () => {
    jest.spyOn(useIsWrongChainHook, 'default').mockImplementation(() => false)
    jest.spyOn(useIsSafeOwnerHook, 'default').mockImplementation(() => true)

    jest
      .spyOn(useAsyncHook, 'default')
      .mockReturnValue([
        { confirmations: [] as SafeMessage['confirmations'] } as SafeMessage,
        new Error('SafeMessage not found'),
        false,
      ])

    const confirmationSpy = jest
      .spyOn(sender, 'dispatchSafeMsgConfirmation')
      .mockImplementation(() => Promise.reject(new Error('Test error')))

    const { getByText } = render(
      <MsgModal
        logoUri="www.fake.com/test.png"
        name="Test App"
        message="Hello world!"
        requestId="123"
        onClose={jest.fn}
        safeAppId={25}
      />,
    )

    const button = getByText('Sign')

    await act(() => {
      fireEvent.click(button)
    })

    expect(confirmationSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(getByText('Error confirming the message. Please try again.')).toBeInTheDocument()
    })
  })
})
