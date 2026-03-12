import { ICommonAPIParams } from '../../constant/types';
/**
 * 读取NFC芯片内容 请求参数定义
 * @apiName readNFC
 */
export interface IUnionReadNFCParams extends ICommonAPIParams {
}
/**
 * 读取NFC芯片内容 返回结果定义
 * @apiName readNFC
 */
export interface IUnionReadNFCResult {
    content: string;
}
/**
 * 读取NFC芯片内容
 * @apiName readNFC
 */
export declare function readNFC$(params: IUnionReadNFCParams): Promise<IUnionReadNFCResult>;
export default readNFC$;
