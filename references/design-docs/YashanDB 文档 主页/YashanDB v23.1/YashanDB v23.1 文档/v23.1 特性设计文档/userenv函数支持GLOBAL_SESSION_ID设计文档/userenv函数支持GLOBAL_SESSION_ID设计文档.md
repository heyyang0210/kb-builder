Created by 汪少华, last modified by  冯浩楠 on 一月 25, 2024

#   [userenv gsid Design（XXX方案设计）](#userenv-gsid-designxxx方案设计)  

  [https://jira.yasdb.com/browse/YDBRD-14407](https://jira.yasdb.com/browse/YDBRD-14407)  

##   [1. Overview（概述）](#1-overview概述)  

分布式下，存在一个全局sid的概念，称为global session id, 简称gsid，是一个大于65536的32位值，希望能够在userenv中显示gsid字段，区别于sid。

##   [2. Features（功能特性）](#2-features功能特性)  

支持用usernev('gsid'); 查询

支持作为过滤条件，保持各节点一致。

##   [3. Interfaces（接口）](#3-interfaces接口)  

select userenv('gsid') from dual;

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

该字段仅在分布式环境有效，其他环境应当报错。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```
UENV_GSID, // global session id

static CodResult uenvGetGSID(AnlStmt* stmt, Variant* retValue)
{
    if (stmt-&gt;handler-&gt;dstbSession == NULL) {
        COD_IMPL_ERROR("global session id on this session");
    }
    retValue-&gt;type = DTYPE_NUMBER;
    retValue-&gt;isNull = COD_FALSE;
    codNumberFromInt64(&amp;retValue-&gt;vNumber, (CodInt64)anlGetGlobalSessionId(stmt-&gt;handler));
    return COD_SUCCESS;
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

select count(*)  from dual where userenv('gsid') > 65536;

5节点集群

select count(*) from dv$session where global_session_id = userenv('gsid');

##   [7. Document（资料）](#7-document资料)  

- GSID：当前会话所的全局会话ID，每一个会话具有不同的GSID，不同CN间亦不相同。函数对该参数返回一个NUMBER类型的数值。


##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-5-11_16-45-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2VhMWFkOWEzMzExZGM3ZGQzIiwicmVmX2lkIjoiNjczOTZhY2U1OTNmOTljOWZmMjM1YTJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyOTQ5LCJleHAiOjE3ODIyOTkzNDl9.t8-8yaGhfMHaEoIqtmdPfb1xu3ftGjFYe7Iu5Krfb5M)

 (image/png)    


[image2023-5-11_11-57-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2U4OTcwYzJhZjRmNTFmZjViIiwicmVmX2lkIjoiNjczOTZhY2U1OTNmOTljOWZmMjM1YTJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyOTQ5LCJleHAiOjE3ODIyOTkzNDl9.c_1DgSyB72_MmSmuLWbWHSifrnOdK1YOclHstRgV360)

 (image/png)    


[image2023-5-11_11-53-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2U4OTcwYzJhZjRmNTFmZjVjIiwicmVmX2lkIjoiNjczOTZhY2U1OTNmOTljOWZmMjM1YTJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyOTQ5LCJleHAiOjE3ODIyOTkzNDl9.89JoxnF81pyGS_X3LNIVZboVuwvFgTlWCno1uvvKzlY)

 (image/png)    


[image2023-5-11_10-42-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2U4OTcwYzJhZjRmNTFmZjVkIiwicmVmX2lkIjoiNjczOTZhY2U1OTNmOTljOWZmMjM1YTJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyOTQ5LCJleHAiOjE3ODIyOTkzNDl9.nBdy1V8uybTyIEEOOeIYjY_naKPxjf-lQQPBCPiu4fA)

 (image/png)    


[image2023-5-11_10-42-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2VhMWFkOWEzMzExZGM3ZGQ0IiwicmVmX2lkIjoiNjczOTZhY2U1OTNmOTljOWZmMjM1YTJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyOTQ5LCJleHAiOjE3ODIyOTkzNDl9.lJVGEGkhCTynfMPc9kK2ePOCzlxj-cSnt01n0LxnYCc)

 (image/png)    


## Comments:

|  [](null)  ,预期错误码：  global session id on this session is not supported,Posted by wangshaohua at 六月 07, 2023 16:46|
|---|
