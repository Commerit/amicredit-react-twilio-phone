import React, { useRef, useEffect } from "react";
import "./Dialler.css";
import KeypadButton from "./KeypadButton";
import PhoneInput from "react-phone-number-input/input";
import "react-phone-number-input/style.css";

const Dialler = ({ number, setNumber }) => {
  const inputRef = useRef();

  // Always focus the input for keyboard typing
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef, number]);

  const handleNumberChange = value => {
    setNumber(value || "");
  };

  const handleBackSpace = () => {
    setNumber(number.substring(0, number.length - 1));
  };

  const handleNumberPressed = newNumber => {
    return () => {
      setNumber(`${number || ""}${newNumber}`);
    };
  };

  // Keyboard input for keypad
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key.match(/[0-9+]/)) {
        setNumber((prev) => (prev || "") + e.key);
      } else if (e.key === "Backspace") {
        setNumber((prev) => prev.substring(0, prev.length - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setNumber]);

  return (
    <div className="dialler-container">
      <PhoneInput
        ref={inputRef}
        country="US"
        value={number}
        onChange={handleNumberChange}
        international
        withCountryCallingCode
        className="input phone-input"
        placeholder="Enter phone number"
      />
      <ol className="keypad">
        <li>
          <KeypadButton handleClick={handleNumberPressed("1")}>1</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("2")}>2</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("3")}>3</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("4")}>4</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("5")}>5</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("6")}>6</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("7")}>7</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("8")}>8</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("9")}>9</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("+")}>+</KeypadButton>
        </li>
        <li>
          <KeypadButton handleClick={handleNumberPressed("0")}>0</KeypadButton>
        </li>
        {number && number.length > 0 && (
          <li>
            <KeypadButton handleClick={handleBackSpace}>&lt;&lt;</KeypadButton>
          </li>
        )}
      </ol>
    </div>
  );
};

export default Dialler;
