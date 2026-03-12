export declare const apiName = "internal.alidoc.keyboardCompression";
/**
 * 当H5页面出现键盘时的视图大小和位置都收缩到键盘之上的可见区域(仅iOS) 请求参数定义
 * @apiName internal.alidoc.keyboardCompression
 */
export interface IInternalAlidocKeyboardCompressionParams {
    /** 是否开启功能 */
    enable: boolean;
}
/**
 * 当H5页面出现键盘时的视图大小和位置都收缩到键盘之上的可见区域(仅iOS) 返回结果定义
 * @apiName internal.alidoc.keyboardCompression
 */
export interface IInternalAlidocKeyboardCompressionResult {
    [key: string]: any;
}
/**
 * 当H5页面出现键盘时的视图大小和位置都收缩到键盘之上的可见区域(仅iOS)
 * @apiName internal.alidoc.keyboardCompression
 * @supportVersion ios: 4.5.12
 */
export declare function keyboardCompression$(params: IInternalAlidocKeyboardCompressionParams): Promise<IInternalAlidocKeyboardCompressionResult>;
export default keyboardCompression$;
