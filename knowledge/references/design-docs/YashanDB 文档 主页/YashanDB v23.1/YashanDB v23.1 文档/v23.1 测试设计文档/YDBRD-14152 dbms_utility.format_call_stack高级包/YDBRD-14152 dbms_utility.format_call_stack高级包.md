Created by 刘晓芳, last modified by  钟溱 on 十月 17, 2024

# **1. 概述**

本文描述dbms_utility.format_call_stack高级包的测试设计；  **FORMAT_CALL_STACK**     返回当前call stack（plsql函数调用栈）的格式化输出，用于stored procedure或触发器中去获取call stack，对debug十分有用；

Oracle文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_UTILITY.html#GUID-89F43F70-F3AD-4DC6-A0EC-ED1E3CEE6648](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_UTILITY.html#GUID-89F43F70-F3AD-4DC6-A0EC-ED1E3CEE6648)  

开发设计：    [DBMS_UTILITY调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109581064)  

SR：    [YDBRD-14156](https://jira.yasdb.com/browse/YDBRD-14156?src=confmacro)    -  DBMS_UTILITY高级包支持FORMAT_CALL_STACK功能  完成

# **2. 需求分析**

## 2.1语法

DBMS_UTILITY.FORMAT_CALL_STACK   

      RETURN     VARCHAR2;

## 2.2 功能描述

（1）返回当前call stack的格式化输出，最大2000字节，  超过2000个字节时截断后面的内容  ；

（2）输出四列信息，object handle为对象内存地址，line number为行号，object对象类型（普通sql语句显示anonymous，trigger不显示），name对象名称，包含schema，对于package或type的子过程体还包含package或type名字和子过程体名字，package的init section输出为schema.packName.__pkg_ini；

（3）  能在在任何stored procedure中使用，以及匿名块和普通sql语句中使用，普通sql语句输出对象为anonymous block；

（4）  如果是非so sql或so中的sql语句调用format_error_stack，此时补充输出一个anonymous；

  


## 2.3 规格限制

（1）对于job这种内置高级包调用的过程体中使用的format_error_stack，并不会显示内置高级包的调用栈（与oracle有差异，oracle的内置高级包也是使用package实现的，我们内置高级包类似于内置函数实现）；

（2）  如果是so中sql语句再调用过程体，被调用的过程体内调用format_error_stack，并不会输出sql语句的栈帧

（3）plsql的嵌套最大可以到128层；

  


**3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

测试场景：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|关键字校验|/|- 高级包覆盖 全大小，全小写，大小写混合
- dbms_utility.format_call_stack()
|  
|- 高级包拼写缺失
- 缺少dbms_utility
- 传参
|报错，提示正确|
|  
|/|- 创建dbms_utility用户，format_call_stack表
|/|/|/|
|调用对象|匿名块|  
,- begin开始设置savpoint a，然后调用高级包，调用其他plsql（里面也调用高级包），最后rollback to a
- exception调用call_stack高级包
- for循环里面调用call_stack高级包
|- 匹配到的when会输出高级包stack，不匹配的不会输出
- stack能在正常输出
- stack能在正常输出
,  
|- close dbms_utility.format_call_stack
|报错，提示正确|
|  
|自定义函数|- case xx when（多个），部分when调用call_stack高级包，部分不调用；构造数据匹配when条件
- if 分支，else分支调用call_stack高级包（  需要构造匹配if，匹配else的场景  ）
- while分支调用call_stack高级包
- return call_stack高级包
- exception调用call_stack高级包
|- 匹配的when分支里面的高级包能正常输出stack
- 第2-5点，预期结果通when
|- 参数申明时，初始值调用call_stack高级包
|报错，提示正确|
|  
|存储过程|- insert into table values 调用高级包
- update set赋值给指定列时指定call_stack高级包
- loop分支调用call_stack
- exception调用call_stack高级包
- exception分支，使用insert into values语句掉哦用call_stack高级包插入指定表中
|- stack能正常插入/更新到表中，查询显示正确
|- 参数申明时，初始值调用call_stack高级包
|报错，提示正确|
|  
|自定义高级包|- head中调用call_stack，body中不调用
- head中不调用，body中调用
- head、body中同时调用
- package中调用存储过程，存储过程调用自定义函数，高级包分别在package调用、自定义函数中调用
|  
|- **高级包调自定义函数、自定义函数调用存储过程，存储过程调用高级包，形成环**
|  
|
|  
|自定义type|- udt body代码里面调用call_stack，udt调用的其他plsql不调用call_stack
- udt body不调用call_stack，udt里面调用的其他plsql调用call_stack
- 两者同时调用call_stack
|  
|  
|  
|
|  
|trigger|- 在insert/update/delete中分别调用call_stack
- 对目标表进行insert/update/delete操作触发触发器生效
- 自治事务触发器调用call_stack
|  
|  
|  
|
|  
|job|- 
,```
DBMS_JOB<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SUBMIT创建job，what指定调用call_stack的plsql，修改系统时间，触发job运行
```|  
|  
|  
|
|  
|其他|- insert into table values 调用高级包
- 建表作为默认值
- update set赋值给指定列时指定call_stack高级包
- select into var
- **insert、update、select from dual 调用自定义函数，自定义函数调用高级包；**
|  
|  
|  
|
|对象嵌套|/|- 嵌套最大层数，在最底层的plsql里面调用call_stack
- 嵌套最大层数，在第50层的plsql里面调用call_stack
- 嵌套最大层数，在第1层的plsql里面调用call_stack
|**TODO：出现栈不足时，调大内存，需要摸索到最大边界**|  
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
|- 返回字符超过2000字符（可以通过嵌套多层，在最里层调用call_stack）
|  
|  
|  
|
|  
|  
|- 构造line number超过64K的场景  --代码块通过null填充；
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


  
