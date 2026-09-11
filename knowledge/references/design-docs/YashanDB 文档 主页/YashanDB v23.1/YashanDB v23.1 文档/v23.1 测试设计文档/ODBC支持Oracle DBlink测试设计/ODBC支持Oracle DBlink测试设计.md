Created by 龚雯, last modified on 十月 15, 2024

# 1.   **概述**

描述Oracle连接崖山执行语句的测试设计

# 2.   **需求分析**

  [ODBC 支持ORACLE DBLINK 连接 YashanDB - 冯皓博 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112722301)  

# 3.   **测试设计方法**   

等价类划分；场景分析

# 4.   **详细测试设计**

1.普通语句执行

通用

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|delete单表数据量|删除全表|delete1|  
|  
|  
|  
|
|  
|删除部分数据|delete1|  
|  
|  
|  
|
|delete语句schema|不带schema|delete2|  
|带无权访问的schema|delete3|  
|
|  
|带有权访问的schema|delete3|  
|  
|  
|  
|
|delete表类型|heap|delete1|  
|  
|  
|  
|
|  
|tac|delete2|  
|  
|  
|  
|
|  
|lsc|delete2|  
|  
|  
|  
|
|  
|临时表|delete2|未做，可能Oracle拦截|  
|  
|  
|
|  
|分区表|delete2|  
|  
|  
|  
|
|delete语句使用的表|全远端表|delete4|  
|  
|  
|  
|
|  
|删除远端表，子查询本地表|delete4|失败|  
|  
|  
|
|  
|删除本地表，子查询远端表|delete4|成功|  
|  
|  
|
|delete语法图覆盖|  
|delete5|  
|多表delete|delete5|  
|
|insert单表单行列数|单列|insert1|  
|  
|  
|  
|
|  
|多列|insert1|  
|  
|  
|  
|
|insert表个数|单表|insert1|  
|多表|insert5|  
|
|insert数据类型|崖山全部类型|datatype*|  
|  
|  
|  
|
|  
|udt|datatype23|  
|  
|  
|  
|
|insert值|常量|insert1|  
|  
|  
|  
|
|  
|default|insert2|  
|  
|  
|  
|
|insert语句schema|不带schema|insert1|  
|带无权访问的schema|insert3|  
|
|  
|带有权访问的schema|insert3|  
|  
|  
|  
|
|insert表类型|heap|insert4|  
|  
|  
|  
|
|  
|tac|insert4|  
|  
|  
|  
|
|  
|lsc|insert4|  
|  
|  
|  
|
|  
|临时表|insert4|  
|  
|  
|  
|
|  
|分区表|insert4|  
|  
|  
|  
|
|insert语句是否指定列|指定|insert1|  
|  
|  
|  
|
|  
|不指定|insert1|  
|  
|  
|  
|
|insert指定列和表结构的关系|指定全表列，和create顺序一致|insert6|  
|指定重复列|insert6|  
|
|  
|指定全表列，和create顺序不一致|insert6|  
|指定不存在的列|insert6|  
|
|  
|指定部分列，其他列可以为空|insert6|  
|指定部分列，其他列不可以为空|insert6|  
|
|insert语法图覆盖|  
|insert7|  
|insert select|insert7|  
|
|update表类型|heap|update1|  
|  
|  
|  
|
|  
|tac|update1|  
|  
|  
|  
|
|  
|lsc|update1|  
|  
|  
|  
|
|  
|临时表|update1|  
|  
|  
|  
|
|  
|分区表|update1|  
|  
|  
|  
|
|update语句schema|不带schema|update1|  
|带无权访问的schema|update2|  
|
|  
|带有权访问的schema|update2|  
|  
|  
|  
|
|update语句使用的表|全远端表|update3|失败|  
|  
|  
|
|  
|更新远端表，子查询本地表|update3|失败|  
|  
|  
|
|  
|更新本地表，子查询远端表|update3|成功|  
|  
|  
|
|update语法图覆盖|  
|update4|  
|多表update|update5|失败|
|select语法|见xmind|  
|  
|connect by|select8|  
|
|  
|  
|  
|  
|nowait|select8|  
|
|  
|  
|  
|  
|start with|select8|  
|
|  
|  
|  
|  
|where current of|select8|  
|
|  
|  
|  
|  
|for update|select8|  
|
|plsql类型|存储过程|plsql3|  
|  
|  
|  
|
|  
|匿名块|plsql1|  
|  
|  
|  
|
|  
|自定义函数|plsql2|  
|  
|  
|  
|
|  
|触发器|plsql4|  
|  
|  
|  
|
|  
|外置udf|无|不支持调用崖山自定义函数，外置的也无需测试|  
|  
|  
|


差异

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|Oracle支持崖山不支持的对象|数据类型|  
|  
|  
|  
|  
|
|  
|函数|  
|  
|  
|  
|  
|
|  
|语法|  
|  
|  
|  
|  
|
|Oracle不支持崖山支持的对象|数据类型|  
|  
|  
|  
|  
|
|  
|函数|  
|  
|  
|  
|  
|
|  
|语法|  
|  
|  
|  
|  
|
|Oracle和崖山都支持但有差异|数据类型边界值|  
|  
|  
|  
|  
|
|  
|对象名长度限制|  
|  
|  
|  
|  
|
|暂不支持|中文|  
|  
|  
|  
|  
|
|  
|特殊字符|  
|  
|  
|  
|  
|


  


2.高级包执行

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|Oracle拦截语法|  
|  
|  
|begin|package1|  
|
|  
|  
|  
|  
|commit|package1|  
|
|  
|  
|  
|  
|rollback|package1|  
|
|  
|  
|  
|  
|save|package1|  
|
|  
|  
|  
|  
|shutdown|package1|  
|
|Oracle不支持，崖山支持|insert多个values|package2|  
|  
|  
|  
|
|  
|boolean类型|package2|  
|  
|  
|  
|
|Oracle不支持，崖山不支持|乱码|package3|由崖山报错，Oracle不拦截|  
|  
|  
|
|Oracle和崖山均支持，不能直接执行,可以用高级包执行|alter|package4|  
|  
|  
|  
|
|  
|create|package2|  
|  
|  
|  
|
|  
|drop|package2|  
|  
|  
|  
|
|  
|grant|package5|  
|  
|  
|  
|
|  
|insert select 远端-远端|package6|  
|insert select 远端-本地|package6|  
|


3.网关

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|操作类型|insert|gateway1|  
|  
|  
|  
|
|  
|create|gateway2|  
|  
|  
|  
|
|  
|append|gateway3|  
|  
|  
|  
|
|  
|replace|gateway4|  
|  
|  
|  
|
|数据源表和目标表|远端-远端|无|已测试，Oracle不支持|  
|  
|  
|
|  
|远端-本地|gateway1|  
|  
|  
|  
|
|  
|本地-远端|gateway1|  
|  
|  
|  
|
|  
|本地-本地|无|Oracle自身测试，与崖山无关|  
|  
|  
|
|Oracle数据类型|- CHAR
- DATE
- LONG
- NUMBER
- VARCHAR2
|  
|本地表和远端表数据类型需要全交叉|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|


4.批量绑定

odbc执行insert多行多列，覆盖所有odbc数据类型

# 5.  ** 测试用例设计**

# 6.   **测试框架设计**

使用yat框架测试

# 7.   **测试环境说明**

Linux x86环境，19c的Oracle

## Comments:

|  [](null)  ,number的精度，在insert，select，网关中需要关注,Posted by gongwen at 六月 14, 2023 15:07|
|---|
