Created by 徐千禧, last modified on 七月 11, 2023

# YDBRD-16483:UNSUPPORT_ERROR Function Design

  [YDBRD-16483](https://jira.yasdb.com/browse/YDBRD-16483)  

##   [1.Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

SQL语句中出现UNSUPPORT_ERROR函数则会抛出无法执行的错误This statement is temporarily unable to execute due to an internal error  。

该语句因内部错误暂时无法执行。

##   [ 2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

### 语法

UNSUPPORT_ERROR()

没有参数。

##   [ 3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

校验阶段返回报错。

CodResult bifVerifyUnsupportError(AnlVerify* vrfr, ExprNode* func);

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

1. 不能有参数。
1. 括号可以省略。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

1. 注册内置函数 gBuiltinMethods。
1. 在verify阶段执行cod set error函数返回报错。
1. 新增错误代码ERR_ANS_VERIFY_UNSUPPORT_ERROR。


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

|序号|场景|备注|
|---|---|---|
|1|select unsupport_error() from dual;|输出  This statement is temporarily unable to execute due to an internal error|
|2|select unsupport_error from dual;|输出  This statement is temporarily unable to execute due to an internal error|


##   [ 7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  

##   [ 8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113974091)  