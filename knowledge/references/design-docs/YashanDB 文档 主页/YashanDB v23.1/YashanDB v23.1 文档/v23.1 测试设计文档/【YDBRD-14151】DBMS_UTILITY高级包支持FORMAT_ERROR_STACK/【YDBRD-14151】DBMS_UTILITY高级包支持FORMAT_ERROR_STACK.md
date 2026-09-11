Created by 刘晓芳 on 十一月 14, 2023

# **1. 概述**

本文描述dbms_utility.format_call_stack高级包的测试设计；  **FORMAT_CALL_STACK**     返回当前call stack（plsql函数调用栈）的格式化输出，用于stored procedure或触发器中去获取call stack，对debug十分有用；

Oracle文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_UTILITY.html#GUID-BF8C0CE6-872A-4CD8-9A78-5FB11C2206EC](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_UTILITY.html#GUID-BF8C0CE6-872A-4CD8-9A78-5FB11C2206EC)  

开发设计：    [DBMS_UTILITY调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109581064)  

SR：       [YDBRD-14155](https://jira.yasdb.com/browse/YDBRD-14155?src=confmacro)    -  DBMS_UTILITY高级包支持FORMAT_ERROR_STACK  完成

             [YDBRD-14151](https://jira.yasdb.com/browse/YDBRD-14151?src=confmacro)    -  DBMS_UTILITY高级包支持FORMAT_ERROR_STACK  完成

# **2. 需求分析**

## 2.1语法

DBMS_UTILITY.FORMAT_ERROR_STACK

      RETURN     VARCHAR2;

## 2.2 功能描述

（1）在存在执行错误的情况下输出错误信息，否则输出null，不在plsql的exception位置调用输出null  ；

（2）  存在多个错误时，例如exception嵌套或者调用plsql对象，错误信息依次入栈，输出时按先进后出的次序（出栈次序）依次输出错误信息，用换行符分隔，最后一个错误信息也会输出一个换行符  ；

（3）  使用超过2000个字节的errMsg，输出截断，入股回退栈帧时会恢复被截断的内容（buf大小为4000）；

（4）调用存储过程或自定义函数时，存储过程或自定义函数内部的error stack会在退出调用时退栈  ；

（5）  普通的用户自定义异常与系统错误处理逻辑一致；

  


## 2.3 规格限制

（1）  使用raise_application_error生成异常会清空之前的error stack，设置为raise_application_error的错误信息，后续可以继续入栈新的错误信息，但在存储过程调用结束后，error stack不会恢复调用前的栈帧，而是为清空状态，且清空状态会向调用栈的外层传染  ；

  


**3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

测试场景：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|关键字校验|/|- 高级包覆盖 全大小，全小写，大小写混合
- dbms_utility.format_error_stack()
|  
|- 高级包拼写缺失
- 缺少dbms_utility
- 传参
|报错，提示正确|
|调用对象|/|覆盖：,- 匿名块
- 自定义函数
- 存储过程
- 自定义高级包
- udt
- trigger
- job
|高优先级|  
|  
|
|调用位置|/|覆盖：,- 在exception分支以外的地方调用error_stack，plsql存在报错
- 多个exception分支，部分调用error_stack，部分不调用error_stack
    - 构造plsql异常只匹配第1个异常分支，中间异常分支，最后1个异常分支；
    - 构造plsql异常，匹配多个异常分支，覆盖调用error_stack，不调用error_stack；
    - 构造plsql异常，匹配全部异常分支；
- 在exception分支里面，调用insert into 语句将error_stack高级包内容更新到表中保存
|高优先级|  
|  
|
|  
|  
|- 开启debug模式，调用call_stack，error_stack高级包
|中优先级|  
|  
|
|异常类型|系统异常|- DUP_VAL_ON_INDEX
- INVALID_NUMBER
- NO_DATA_FOUND
- VALUE_ERROR
- ZERO_DIVIDE
- others异常
|高优先级|  
|  
|
|  
|**自定义异常（ude）**|- EXCEPTION声明异常名称
- exception init
- #### DBMS_AUDIT_MGMT
|**参照存量用例**,**高优先级**|  
|  
|
|  
|直接生成异常|通过    [RAISE_APPLICATION_ERROR](http://cod-doc/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.html#RAISEAPPLICATIONERROR)    方式,- pro1调用pro2,pro3等多个子程序，pro1通过    [RAISE_APP](http://cod-doc/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.html#RAISEAPPLICATIONERROR)    生成异常
- pro1调用pro2,pro3等多个子程序，子程序调用    [RAISE_APP](http://cod-doc/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.html#RAISEAPPLICATIONERROR)    生成异常
- pro1调用pro2，pro2调用pro3,pro3调用pro4，在pro4调用    [RAISE_APP](http://cod-doc/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86.html#RAISEAPPLICATIONERROR)    生成异常
|高优先级|  
|  
|
|  
|其他|- sql code
- sql manager
|**参照存量用例**  ：  **自定义变量区需要关注**|  
|  
|
|嵌套|对象嵌套|- 匿名块调用自定义高级包、自定义函数、存储过程等plsql模块，覆盖所有对象都带异常分支/部分对象带异常分支
- 匿名块调用自定义高级包，自定义高级包调用自定义函数、自定义函数调用存储过程；  覆盖exception和代码块调用。
- 成环调用
|  
|  
|  
|
|  
|异常嵌套|- 在一个plsql对象里面，exception里面继续嵌套exception
- 在一个plsql对象里面，exception里面通过其他写其他plsql对象嵌套异常
|  
|  
|  
|
|调用次数|  
|- 调用1次
- 连续调用多次（可以通过for循环实现）
|  
|  
|  
|
|规格|  
|- 返回字符超过2000字节（可以通过嵌套多层，在最里层调用error_stack） —   通过外层自定义异常带入子程序实现
- 嵌套256层异常分支--覆盖嵌套边界值
|中优先级|  
|  
|
|**预埋用例**|  
|- **TODO:内置高级包实现异常捕获功能后，需要补充用例**
|  
|  
|  
|


  


# **4. 详细设计**

见第3章节

#   
  5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|


  


  
