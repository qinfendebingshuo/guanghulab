export declare const apiName = "internal.contact.internalComplexPicker";
/**
 * 企业主页选人组件 请求参数定义
 * @apiName internal.contact.internalComplexPicker
 */
export interface IInternalContactInternalComplexPickerParams {
    [key: string]: any;
}
/**
 * 企业主页选人组件 返回结果定义
 * @apiName internal.contact.internalComplexPicker
 */
export interface IInternalContactInternalComplexPickerResult {
    [key: string]: any;
}
/**
 * 企业主页选人组件
 * @apiName internal.contact.internalComplexPicker
 * @supportVersion  ios: 4.2.8 android: 4.2.8
 */
export declare function internalComplexPicker$(params: IInternalContactInternalComplexPickerParams): Promise<IInternalContactInternalComplexPickerResult>;
export default internalComplexPicker$;
