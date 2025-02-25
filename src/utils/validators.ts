import validator from "validator";
import PasswordValidator from "password-validator";

export const validateEmail = (email: string): boolean => validator.isEmail(email);

export const passwordSchema = new PasswordValidator();
passwordSchema.is().min(8).is().max(64).has().letters().has().digits().has().not().spaces();

export const validatePassword = (password: string): boolean => <boolean>passwordSchema.validate(password);