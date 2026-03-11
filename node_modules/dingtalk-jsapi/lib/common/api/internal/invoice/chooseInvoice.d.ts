export declare const apiName = "internal.invoice.chooseInvoice";
/**
 * 获取本地微信客户端的电子发票列表数据 请求参数定义
 * @apiName internal.invoice.chooseInvoice
 */
export interface IInternalInvoiceChooseInvoiceParams {
}
/**
 * 获取本地微信客户端的电子发票列表数据 返回结果定义
 * @apiName internal.invoice.chooseInvoice
 */
export interface IInternalInvoiceChooseInvoiceResult {
    /** 用户在wx发票列表页选择的发票 */
    cardInfo: Array<{
        /** 发票Id */
        cardId: string;
        /** 换取明文信息所需加密code */
        encryptCode: string;
    }>;
}
/**
 * 获取本地微信客户端的电子发票列表数据
 * @apiName internal.invoice.chooseInvoice
 * @supportVersion ios: 4.7.9 android: 4.7.9
 * @author Android: 泽乾; iOS: 姚曦
 */
export declare function chooseInvoice$(params: IInternalInvoiceChooseInvoiceParams): Promise<IInternalInvoiceChooseInvoiceResult>;
export default chooseInvoice$;
