export declare const apiName = "biz.kingGrid.approvalPdf";
/**
 * 金格单PDF审批功能 请求参数定义
 * @apiName biz.kingGrid.approvalPdf
 */
export interface IBizKingGridApprovalPdfParams {
    /** PDF编辑作者 */
    pdfEditorAuthor: string;
    /** PDF下载地址 */
    pdfDownloadUrl: string;
    /**  PDF编辑上传方法 采用POST 上传key为uploadFileName到uploadUrl的地址 */
    pdfUploadMethod: {
        /** 上传地址 */
        uploadUrl: string;
        /** 文件流对应的key */
        uploadFileName: string;
        /** httpform */
        uploadForms: {
            [key: string]: string;
        };
        /** httpheader */
        uploadHeaders: {
            [key: string]: string;
        };
    };
}
/**
 * 金格单PDF审批功能 返回结果定义
 * @apiName biz.kingGrid.approvalPdf
 */
export interface IBizKingGridApprovalPdfResult {
    /**
     * -1 OK //完成了批注并上传成功
     * 4 //文档未修改 用户不选择保存
     * 0 //取消 没有任何相关操作
     * 2 //下载PDF失败
     * 3 //上传PDF失败
     * 5 //打开文件失败
     */
    result: string;
}
/**
 * 金格单PDF审批功能
 * 仅支持android 北京政府项目客户端
 * @apiName biz.kingGrid.approvalPdf
 * @supportVersion android: 4.5.16
 */
export declare function approvalPdf$(params: IBizKingGridApprovalPdfParams): Promise<IBizKingGridApprovalPdfResult>;
export default approvalPdf$;
