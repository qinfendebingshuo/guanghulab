export declare const apiName = "internal.log.printUnifyLog";
/**
 * 打印通用日志 请求参数定义
 * dp前缀的入参只支持4.6.9以上
 * @apiName internal.log.printUnifyLog
 */
export interface IInternalLogPrintUnifyLogParams {
    /** 版本，默认1.0 string 非必选 */
    dp_ver?: string;
    /** 业务类型，内容以js_开头 string 非必选 */
    dp_biztype?: string;
    /** 业务子类型，默认空字符串 string 非必选 */
    dp_subtype?: string;
    /** 文件mime，默认空字符串 string 非必选  */
    dp_mime?: string;
    /** 通道，默认空字符串 string 非必选 */
    dp_channel?: string;
    /** 结果，成功：Y，失败：N string 非必选 */
    dp_result?: string;
    /** 错误码，默认空字符串，失败的时候必选 string 非必选 */
    dp_err_code?: string;
    /** 状态码，默认空字符串 string 非必选 */
    dp_stat_code?: string;
    /** 保留1，默认空字符串 string 非必选 */
    dp_res1?: string;
    /** 保留2，默认空字符串 string 非必选 */
    dp_res2?: string;
    /** 保留3，默认空字符串 string 非必选 */
    dp_res3?: string;
    /** 保留4，默认空字符串 string 非必选 */
    dp_res4?: string;
    /** 速度，默认0 number 非必选 */
    dp_rate?: number;
    /** 总大小，默认0 number 非必选 */
    dp_total_size?: number;
    /** 传输大小，默认0 number 非必选 */
    dp_xfer_size?: number;
    /** 耗时，默认0 double 非必选 */
    dp_cost?: number;
    /** 值：如”cspace_preview”; */
    bizType?: string;
    /** 成功时："{"success":true, "errorCode":"0","rt":xxx,"errorMessage":"", respond:""}"
     *  失败时："{"success":false, "errorCode":"2003","rt":xxx,"errorMessage":"lwpTimeout", respond:""}"
     */
    data?: {
        success: boolean;
        errorCode: string;
        rt: number;
        errorMessage: string;
        respond: string;
    };
}
/**
 * 打印通用日志 返回结果定义
 * @apiName internal.log.printUnifyLog
 */
export interface IInternalLogPrintUnifyLogResult {
    [key: string]: any;
}
/**
 * 打印通用日志
 * @apiName internal.log.printUnifyLog
 * @supportVersion ios: 4.5.10 android: 4.5.10 pc: 4.5.10
 */
export declare function printUnifyLog$(params: IInternalLogPrintUnifyLogParams): Promise<IInternalLogPrintUnifyLogResult>;
export default printUnifyLog$;
