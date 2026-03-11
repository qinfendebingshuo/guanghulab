export declare const apiName = "internal.alidoc.keyboardAccessory";
/**
 * 隐藏iOS在H5出现编辑状态时键盘上方的默认工具条（仅iOS ） 请求参数定义
 * @apiName internal.alidoc.keyboardAccessory
 */
export interface IInternalAlidocKeyboardAccessoryParams {
    /** 是否显示工具条 */
    enable: boolean;
}
/**
 * 隐藏iOS在H5出现编辑状态时键盘上方的默认工具条（仅iOS ） 返回结果定义
 * @apiName internal.alidoc.keyboardAccessory
 */
export interface IInternalAlidocKeyboardAccessoryResult {
    [key: string]: any;
}
/**
 * 隐藏iOS在H5出现编辑状态时键盘上方的默认工具条（仅iOS ）
 * @apiName internal.alidoc.keyboardAccessory
 * @supportVersion ios: 4.5.12
 */
export declare function keyboardAccessory$(params: IInternalAlidocKeyboardAccessoryParams): Promise<IInternalAlidocKeyboardAccessoryResult>;
export default keyboardAccessory$;
