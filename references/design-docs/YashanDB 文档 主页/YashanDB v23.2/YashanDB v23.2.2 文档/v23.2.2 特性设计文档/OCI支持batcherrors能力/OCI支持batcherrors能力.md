Created by 侯忠林, last modified on 四月 25, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

国信证券外场需要支持适配恒生参数属性，batcherrors等能力。所以需要按照OCI的接口要求支持  OCI_ATTR_IS_NULL参数，OCI_BATCH_ERRORS参数以及SQLT_RSET数据类型。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1、OCI_ATTR_IS_NULL属性实现：如果列不允许为空值，则返回0。没有为CUBE或ROLLUP操作返回正确的值。 

2、OCI_BATCH_ERRORS模式实现：为了便于处理数组DML操作，OCI提供了批处理错误模式(也称为增强的DML数组特性)。此模式在调用中指定，如果存在一个或多个错误，则简化DML数组处理。

 3、SQLT_RSET类型支持：分配一个语句句柄OCIStmt，然后使用SQLT_RSET数据类型绑定它的地址OCIStmt **

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

OCIBindByPos

|接口|参数|描述|
|---|---|---|
|OCIAttrGet|sword OCIAttrGet ( const void *trgthndlp,, ub4 trghndltyp,, void *attributep,, ub4 *sizep,, ub4 attrtype,, OCIError *errhp );|新增  trghndltyp和attrtype参数组合,- OCI_DTYPE_PARAM | OCI_ATTR_IS_NULL
- OCI_HTYPE_ERROR | OCI_ATTR_DML_ROW_OFFSET
- OCI_HTYPE_STMT  | OCI_ATTR_NUM_DML_ERRORS
|
|OCIPar  SQLT_RSET  amGet|sword OCIParamGet ( const void *hndlp,, ub4 htype,, OCIError *errhp,, void **parmdpp,, ub4 pos );|htype  新增  有效值  OCI_HTYPE_ERROR   |
|OCIBindByPos   |sword     OCIBindByPos     (     OCIStmt     *  stmtp  ,   ,   OCIBind     **  bindpp  ,,   OCIError     *  errhp  ,,   ub4     position  ,,   void     *  valuep  ,,   sb4     value_sz  ,,   ub2     dty  ,,   void     *  indp  ,,   ub2     *  alenp  ,,   ub2     *  rcodep  ,,   ub4     maxarr_len  ,,   ub4     *  curelep  ,   ,   ub4     mode     );|dty 参数  新增有效值  SQLT_RSET   |
|OCIDefineByPos   |sword     OCIDefineByPos     (     OCIStmt     *  stmtp  ,   ,   OCIDefine     **  defnpp  ,,   OCIError     *  errhp  ,,   ub4     position  ,,   void     *  valuep  ,,   sb4     value_sz  ,,   ub2     dty  ,,   void     *  indp  ,,   ub2     *  rlenp  ,,   ub2     *  rcodep  ,,   ub4     mode     );|dty 参数  新增有效值  SQLT_RSET|


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

cursor投影列数量限制（4096是投影列的限制）

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

1、OCI_ATTR_IS_NULL属性实现：如果列不允许为空值，则返回0。没有为CUBE或ROLLUP操作返回正确的值。

在OCIAttrGet 方法中新增OCI_ATTR_IS_NULL参数的实现，获取param上的  isNull标识。

  


2、OCI_BATCH_ERRORS模式实现：为了便于处理数组DML操作，OCI提供了批处理错误模式(也称为增强的DML数组特性)。此模式在调用中指定，如果存在一个或多个错误，则简化DML数组处理。

首先在  OCIStmtExecute方法中判断是否是  isDmlBatchExecute

存在DmlBatch执行返回批量错误的情况则获取批量错误的个数和错误信息绑定在OCIError上

返回OCI_SUCCESS_WITH_INFO

OCIAttrGet通过  OCI_HTYPE_STMT  | OCI_ATTR_NUM_DML_ERRORS获取错误个数

OCIParamGet通过  OCI_HTYPE_ERROR和pos获取固定位置的OCIError

OCIAttrGet通过  OCI_HTYPE_ERROR | OCI_ATTR_DML_ROW_OFFSET获取error对应的偏移位。

  


 3、SQLT_RSET类型支持：分配一个语句句柄OCIStmt，然后使用SQLT_RSET数据类型绑定它的地址OCIStmt **

OCIBindByPos  支持SQLT_RSET类型绑定出参

OCIDefineByPos  支持SQLT_RSET定义数据类型。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.支持select cursor并校验结果正确

2.支持select 多个cursor

3.支持select cursor中有嵌套cursor

4.   OCIAttrGet获取OCI_ATTR_IS_NULL值正确

5.   OCIAttrGet通过  OCI_HTYPE_STMT  | OCI_ATTR_NUM_DML_ERRORS获取错误个数

6.   OCIParamGet通过  OCI_HTYPE_ERROR和pos获取固定位置的OCIError

7.   OCIAttrGet通过  OCI_HTYPE_ERROR | OCI_ATTR_DML_ROW_OFFSET获取error对应的偏移位。

8. OCIStmtExecute执行批量DML返回部分错误时返回OCI_SUCCESS_WITH_INFO。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量300，7天。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*