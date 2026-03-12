import { ICommonAPIParams } from '../../constant/types';
/**
 * 开启蓝牙广播 请求参数定义
 * @apiName startAdvertising
 */
export interface IUnionStartAdvertisingParams extends ICommonAPIParams {
    services: {
        uuid: string;
        characteristics: {
            uuid: string;
            value?: string;
            permission?: {
                readable: boolean;
                writeable: boolean;
                readEncryptionRequired: boolean;
                writeEncryptionRequired: boolean;
            };
            properties?: {
                read?: boolean;
                write?: boolean;
                notify?: boolean;
                indicate?: boolean;
                writeNoResponse?: boolean;
            };
            descriptors?: {
                uuid: string;
                value?: string;
                permission?: {
                    read: boolean;
                    write: boolean;
                };
            }[];
        }[];
    }[];
    deviceName?: string;
}
/**
 * 开启蓝牙广播 返回结果定义
 * @apiName startAdvertising
 */
export interface IUnionStartAdvertisingResult {
}
/**
 * 开启蓝牙广播
 * @apiName startAdvertising
 */
export declare function startAdvertising$(params: IUnionStartAdvertisingParams): Promise<IUnionStartAdvertisingResult>;
export default startAdvertising$;
