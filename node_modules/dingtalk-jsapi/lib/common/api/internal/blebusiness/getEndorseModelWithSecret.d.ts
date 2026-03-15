export declare const apiName = "internal.blebusiness.getEndorseModelWithSecret";
/**
 * 根据Secret在App端计算加签信息 请求参数定义
 * @apiName internal.blebusiness.getEndorseModelWithSecret
 */
export interface IInternalBlebusinessGetEndorseModelWithSecretParams {
    /** 加密信息 */
    secret: string;
    /** 蓝牙广播信息major属性 */
    major: number;
    /** 蓝牙广播信息minor属性 */
    minor: number;
}
/**
 * 根据Secret在App端计算加签信息 返回结果定义
 * @apiName internal.blebusiness.getEndorseModelWithSecret
 */
export interface IInternalBlebusinessGetEndorseModelWithSecretResult {
    /** DTEndorseModel的JSON字符串 */
    endorseModel: string;
}
/**
 * 根据Secret在App端计算加签信息
 * @apiName internal.blebusiness.getEndorseModelWithSecret
 * @supportVersion ios: 4.6.18 android: 4.6.18
 */
export declare function getEndorseModelWithSecret$(params: IInternalBlebusinessGetEndorseModelWithSecretParams): Promise<IInternalBlebusinessGetEndorseModelWithSecretResult>;
export default getEndorseModelWithSecret$;
