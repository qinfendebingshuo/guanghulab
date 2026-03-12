import { ICommonAPIParams } from '../../constant/types';
/**
 * NFC数据写入 请求参数定义
 * @apiName writeNFC
 */
export interface IUnionWriteNFCParams extends ICommonAPIParams {
    content: string;
}
/**
 * NFC数据写入 返回结果定义
 * @apiName writeNFC
 */
export interface IUnionWriteNFCResult {
}
/**
 * NFC数据写入
 * @apiName writeNFC
 */
export declare function writeNFC$(params: IUnionWriteNFCParams): Promise<IUnionWriteNFCResult>;
export default writeNFC$;
