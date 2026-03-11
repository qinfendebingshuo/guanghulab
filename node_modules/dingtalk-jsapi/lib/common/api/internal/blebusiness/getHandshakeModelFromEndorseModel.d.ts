export declare const apiName = "internal.blebusiness.getHandshakeModelFromEndorseModel";
/**
 * 根据加签模型(DTEndorseModel)转换得到握手模型(DTHandshakeModel) 请求参数定义
 * @apiName internal.blebusiness.getHandshakeModelFromEndorseModel
 */
export interface IInternalBlebusinessGetHandshakeModelFromEndorseModelParams {
    /** DTEndorseModel的JSON字符串 */
    endorseModel: string;
}
/**
 * 根据加签模型(DTEndorseModel)转换得到握手模型(DTHandshakeModel) 返回结果定义
 * @apiName internal.blebusiness.getHandshakeModelFromEndorseModel
 */
export interface IInternalBlebusinessGetHandshakeModelFromEndorseModelResult {
    /** DTHandshakeModel的JSON字符串 */
    handshakeModel: string;
}
/**
 * 根据加签模型(DTEndorseModel)转换得到握手模型(DTHandshakeModel)
 * @apiName internal.blebusiness.getHandshakeModelFromEndorseModel
 * @supportVersion ios: 4.6.18
 */
export declare function getHandshakeModelFromEndorseModel$(params: IInternalBlebusinessGetHandshakeModelFromEndorseModelParams): Promise<IInternalBlebusinessGetHandshakeModelFromEndorseModelResult>;
export default getHandshakeModelFromEndorseModel$;
