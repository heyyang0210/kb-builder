Created by 郑思远, last modified on 八月 30, 2023

# 1.   **概述**

   本文主要内容为JDBC支持投影列cursor的测试设计。

# 2.   **需求分析**

  [YDBRD-13073](https://jira.yasdb.com/browse/YDBRD-13073?src=confmacro)    **-**  **【驱动】JDBC支持投影列cursor类型**  **完成**

设计文档  **：**    [支持投影列cursor类型 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119550612)  

|接口功能|说明|
|:---|:---|
|ResultSet::public Object getObject(int columnIndex) throws SQLException|此接口需要支持如果类型为cursor，则Object固定返回cursor对应的ResultSet结果集|


# 3.   **测试设计方法**

1. getXXX方法与cursor类型交互测试
1. 其他接口或方法的发散测试


# 4.   **详细测试设计**

1. getXXX方法与cursor类型交互测试


|数据库类型\旧接口|getObject|getNString|get  String|get  Boolean|get  Int|get  Byte|get  Short|get  Long|get  Bytes|get  Float|get  Double|getBig  Decimal|get  Date|get  Time|get  Timestamp|get  Blob|get  Clob|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|CURSOR|N|N|Y|N|N|N|N|N|N|N|N|N|N|N|N|N|Y|


是否支持getObject（1，cursor.class）?

2.其他接口或方法的发散测试

1）可滑动结果集 scrollableStatement

    a.查询sql得到的resultset可滑动

    b.getObject() cursor得到的resultset可滑动

不涉及投影列

  


2）多结果集getResultSet

getObject() cursor得到resultsets

不涉及投影列

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


  


## Comments:

|  [](null)  ,覆盖,sys_refcursor    
    
,Posted by zhengsiyuan at 八月 29, 2023 14:37|
|---|
|  [](null)  ,cursor里面的类型覆盖,Posted by zhengsiyuan at 八月 29, 2023 14:38|
|  [](null)  ,覆盖显示、隐式游标,Posted by zhengsiyuan at 八月 29, 2023 14:38|
|  [](null)  ,测试fetch 多个和嵌套,Posted by zhengsiyuan at 八月 29, 2023 14:40|
|  [](null)  ,cursor里面的列数4096列,Posted by zhengsiyuan at 八月 29, 2023 14:40|
|  [](null)  ,过程体的结果为空,Posted by zhengsiyuan at 八月 29, 2023 14:51|
|  [](null)  ,过程体的结果0,Posted by zhengsiyuan at 八月 29, 2023 14:55|
|  [](null)  ,cursor泄露,Posted by zhengsiyuan at 八月 29, 2023 14:56|
|  [](null)  ,无法以投影列的方式返回,Posted by zhengsiyuan at 八月 30, 2023 18:52|
|  [](null)  ,显示隐式游标不支持投影列,Posted by zhengsiyuan at 八月 31, 2023 15:49|
|  [](null)  ,sys_refcursor,Posted by zhengsiyuan at 八月 31, 2023 15:49|
|  [](null)  ,其实就是0行,Posted by zhengsiyuan at 八月 31, 2023 16:00|
