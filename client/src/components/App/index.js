import React, { createContext, useState, useReducer, useEffect } from "react";
import { Route, Redirect, Switch } from "react-router-dom";

import SampleToken1 from "../../contracts/SampleToken1.json";
import SampleToken2 from "../../contracts/SampleToken2.json";
import Factory from "../../contracts/Factory.json";
import Exchange from "../../contracts/Exchange.json";

import Navigation from "../Navigation";
import Home from "../Home";
import Swap from "../Swap";
import Liquidity from "../Liquidity";
import Wallet from "../Wallet";

import tokenLogo from "../../assets/img/erc20.png";

import { getWeb3, getContract, fromWei } from "../../utils/utils";

import "./styles.css";

export const AppContext = createContext();

const App = () => {
    const appReducer = (state, action) => {
        switch (action.type) {
            case "SET_FACTORY":
                return { ...state, factory: action.payload };
            case "ADD_TOKEN":
                return {
                    ...state,
                    tokens: {
                        ...state.tokens,
                        ...action.payload,
                    },
                };
            case "ADD_EXCHANGE":
                return {
                    ...state,
                    exchanges: {
                        ...state.exchanges,
                        [action.payload.token]: action.payload.contract,
                    },
                };
            case "SET_ACCOUNT":
                return { ...state, account: action.payload };
            case "SET_ETH_BALANCE":
                return {
                    ...state,
                    account: { ...state.account, balance: action.payload },
                };
            case "SET_TOKEN_BALANCE":
                return {
                    ...state,
                    tokens: {
                        ...state.tokens,
                        [action.payload.symbol]: {
                            ...state.tokens[action.payload.symbol],
                            balance: action.payload.balance,
                        },
                    },
                };
            default:
                return state;
        }
    };

    const [loading, setLoading] = useState(true);

    const [state, dispatch] = useReducer(appReducer, {
        factory: null,
        tokens: {},
        exchanges: {},
        account: { address: "0x0", balance: 0 },
    });

    const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
            console.log("No account found");

            dispatch({
                type: "SET_ACCOUNT",
                payload: { address: "0x0", balance: 0 },
            });

            for (const symbol of Object.keys(state.tokens)) {
                dispatch({
                    type: "SET_TOKEN_BALANCE",
                    payload: {
                        symbol,
                        balance: 0,
                    },
                });
            }
        } else if (state.account.address !== accounts[0]) {
            console.log("Account changed");
            console.log(accounts);

            console.log("Getting balances");
            const balance = fromWei(
                await window.web3.eth.getBalance(accounts[0])
            );

            dispatch({
                type: "SET_ACCOUNT",
                payload: { address: accounts[0], balance },
            });

            for (const symbol of Object.keys(state.tokens)) {
                const tokenBalance = await state.tokens[symbol].contract.methods
                    .balanceOf(state.account.address)
                    .call();

                dispatch({
                    type: "SET_TOKEN_BALANCE",
                    payload: {
                        symbol,
                        balance: fromWei(tokenBalance),
                    },
                });
            }
        } else {
            console.log("Account not changed?");
        }
    };

    const handleChainIdChanged = (chainId) => {
        console.log("Chain changed to", chainId);
        window.location.reload();
    };

    const handleDisconnect = (error) => {
        console.error(error);
        alert("MetaMask disconnect from network.");
        window.location.reload();
    };

    useEffect(() => {
        const initState = async () => {
            await getWeb3();

            console.log("Getting contracts");

            const factory = await getContract(Factory);
            dispatch({ type: "SET_FACTORY", payload: factory });

            const tokens = [SampleToken1, SampleToken2];
            for (const tokenJson of tokens) {
                const token = await getContract(tokenJson);
                const symbol = await token.methods.symbol().call();

                dispatch({
                    type: "ADD_TOKEN",
                    payload: {
                        [symbol]: {
                            contract: token,
                            symbol: symbol,
                            image: tokenLogo,
                            balance: 0,
                        },
                    },
                });

                const exchangeAddress = await factory.methods
                    .getExchange(token._address)
                    .call();

                if (
                    exchangeAddress ===
                    " 0x0000000000000000000000000000000000000000"
                ) {
                    console.error("Exchange wasn't created during deploy?");
                }

                const exchange = await getContract(Exchange, exchangeAddress);
                exchange._address = exchangeAddress;

                dispatch({
                    type: "ADD_EXCHANGE",
                    payload: {
                        token: symbol,
                        contract: exchange,
                    },
                });
            }

            console.log("Initialize wallet triggers");

            try {
                window.ethereum.on("chainChanged", handleChainIdChanged);

                await window.ethereum
                    .request({ method: "eth_accounts" })
                    .then((accounts) => {
                        handleAccountsChanged(accounts);
                    })
                    .catch((err) => {
                        console.error(err);
                    });

                window.ethereum.on("accountsChanged", handleAccountsChanged);
                window.ethereum.on("disconnect", handleDisconnect);
            } catch (error) {
                alert("Failed to load account.");
                console.error(error);
            }

            setLoading(false);
        };

        initState();
    }, []);

    if (loading) {
        return <div>Loading web3, accounts, and contract...</div>;
    }

    return (
        <div className="App">
            <Navigation />
            <br />
            <main>
                <AppContext.Provider value={[state, dispatch]}>
                    <Switch>
                        <Route exact path="/" component={Home} />
                        <Route path="/swap" component={Swap} />
                        <Route path="/pool" component={Liquidity} />
                        <Route path="/wallet" component={Wallet} />
                        <Redirect to="/" />
                    </Switch>
                </AppContext.Provider>
            </main>
        </div>
    );
};

export default App;
