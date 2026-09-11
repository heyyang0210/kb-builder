Created by 刘晓芳 on 十一月 14, 2023

本文描述OWA_UTIL.WHO_CALLED_ME高级包的测试设计；  调用当前过程或函数的对象信息。该过程通常用于调试和跟踪PL/SQL程序执行过程中的错误。当在程序包中调用OWA_UTIL.WHO_CALLED_ME时，它将返回一个记录，其中包含了调用当前过程的过程或函数的模式、对象名和行号等信息。

Oracle文档：    [OWA_UTIL.WHO_CALLED_ME调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=115147032)  

开发设计：    [OWA_UTIL.WHO_CALLED_ME设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=115147075)  

SR：       [YDBRD-15718](https://jira.yasdb.com/browse/YDBRD-15718?src=confmacro)    -  支持OWA_UTIL.WHO_CALLED_ME函数  完成

             [YDBRD-16727](https://jira.yasdb.com/browse/YDBRD-16727?src=confmacro)    -  支持OWA_UTIL.WHO_CALLED_ME函数  完成

# **2. 需求分析**

## 2.1语法

OWA_UTIL.WHO_CALLED_ME(    

        owner              OUT          VARCHAR2,   

          name               OUT        VARCHAR2,    

        lineno           OUT        NUMBER,    

        caller_t         OUT        VARCHAR2

);

## 2.2 参数：

|Parameter|Description|
|---|---|
|  `owner`  |调用者过程体的owner|
|  `name`  |调用者过程体的名字。如果是package的子程序，则返回package的名字；如果是procedure或function，则返回对应的名称；如果调用者是anonymous，则返回NULL|
|  `lineno`  |调用者的行号|
|  `caller_t`  |调用者的类型。 package body, anonymous block, procedure, and function.|


## 2.2 规格限制

（1）该内置package是由plsql创建的，属于sys用户的高级包，通过PUBLIC SYNONYM使其他用户直接识别。执行package需要有execute any procedure权限

（2）在sys用户可以drop，replace OWA_UTIL高级包（oracle内置高级包大多可以，不要轻易尝试，需要重建库才能找回）

（3）  其他用户可以创建自己用户的OWA_UTIL高级包，在使用时会优先查找自己用户下的高级包

  


# **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

测试场景：复用call_stack测试场景

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|关键字校验,**（补充）**|/|- 高级包覆盖 全大小，全小写，大小写混合
|  
|- 高级包拼写缺失
- 缺少  OWA_UTIL
|报错，提示正确|
||/|- 创建user1，user1新建同样的  OWA_UTIL.WHO_CALLED_ME 高级包
- 查询dba_object视图
- 通过dbms_metadata.get_ddl查询高级包ddl语句
|  
|/|  
|
||/|- 创建  OWA_UTIL  用户，  WHO_CALLED_M  表（sys用户）
- 创建、删除同名udp（sys用户）
|  
|/|/|
|参数校验  **（补充）**|/|- 覆盖传参的数据类型与参数的返回类型不符（可以隐式转换）
- 覆盖可传入参数的边界长度–64字节
- 传入的参数申明时默认值为  WHO_CALLED_ME   高级包
|  
|- 不传入参数
- 覆盖传入1、2、3个参数
- 覆盖传入的参数数据类型与参数值无法转换？
- 参数传入常量值，未定义的变量；
|  
|
|调用对象|匿名块|  
,- 匿名块调用高级包，调用其他plsql（里面也调用高级包）
- exception调用  OWA_UTIL.WHO_CALLED_ME  高级包
- for循环里面调用  OWA_UTIL.WHO_CALLED_ME  高级包
|匿名块的调用信息都为空，匿名块内的调用信息回显正确|- OWA_UTIL.WHO_CALLED_ME
|报错，提示正确|
|  
|自定义函数|- case xx when（多个），部分when调用  OWA_UTIL.WHO_CALLED_ME  高级包，部分不调用；构造数据匹配when条件
- if 分支，else分支调用  OWA_UTIL.WHO_CALLED_ME  高级包（  需要构造匹配if，匹配else的场景  ）
- while分支调用  OWA_UTIL.WHO_CALLED_ME  高级包
- return   OWA_UTIL.WHO_CALLED_ME  高级包
- exception调用  OWA_UTIL.WHO_CALLED_ME  高级包
|- 匹配的when分支里面的高级包能正常输出调用信息
- 第2-5点，预期结果同when
|- 参数申明时，初始值调用  OWA_UTIL.WHO_CALLED_ME  高级包
|报错，提示正确|
|  
|存储过程|- insert into table values 调用高级包
- update set赋值给指定列时指定  WA_UTIL.WHO_CALLED_ME  高级包
- loop分支调用  WA_UTIL.WHO_CALLED_ME
- exception调用  WA_UTIL.WHO_CALLED_ME  高级包
- exception分支，使用insert into values语句调用用  WA_UTIL.WHO_CALLED_ME  高级包插入指定表中
|- 能正常插入/更新到表中，查询显示正确
|- 参数申明时，初始值调用  WA_UTIL.WHO_CALLED_ME  高级包
|报错，提示正确|
|  
|自定义高级包|- head中调用call_stack，body中不调用
- head中不调用，body中调用
- head、body中同时调用
- package中调用存储过程，存储过程调用自定义函数，高级包分别在package调用、自定义函数中调用
|  
|- 高级包调自定义函数、自定义函数调用存储过程，存储过程调用高级包，形成环
|  
|
|  
|自定义type|- udt body代码里面调用  WA_UTIL.WHO_CALLED_ME  ，udt调用的其他plsql不调用  WA_UTIL.WHO_CALLED_ME
- udt body不调用  WA_UTIL.WHO_CALLED_ME  ，udt里面调用的其他plsql调用  WA_UTIL.WHO_CALLED_ME
- 两者同时调用  WA_UTIL.WHO_CALLED_ME
|  
|  
|  
|
|  
|trigger|- 在insert/update/delete中分别调用  WA_UTIL.WHO_CALLED_ME
- 对目标表进行insert/update/delete操作触发触发器生效
- 自治事务触发器调用  WA_UTIL.WHO_CALLED_ME
|  
|  
|  
|
|  
|job|- 
,```
DBMS_JOB<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SUBMIT创建job，what指定调用<span style="color: rgb(23,43,77);">WA_UTIL.WHO_CALLED_ME</span>的plsql，修改系统时间，触发job运行
```|  
|  
|  
|
|  
|其他|- insert into table values 调用高级包
- 建表作为默认值
- update set赋值给指定列时指定call_stack高级包
- select into var
- insert、update、select from dual 调用自定义函数，自定义函数调用高级包；
|  
|  
|  
|
|对象嵌套|/|- 嵌套最大层数，在最底层的plsql里面调用    `WA_UTIL.WHO_CALLED_ME`  
- 嵌套最大层数，在第50层的plsql里面调用    `WA_UTIL.WHO_CALLED_ME`  
- 嵌套最大层数，在第1层的plsql里面调用    `WA_UTIL.WHO_CALLED_ME`  
|  
|  
|  
|
|**（补充）**|  
|- 构造存储过程、自定义函数、高级包的嵌套场景（超过5层），每个plsql都属于不同的schema
|  
|  
|  
|
|调用次数,  
|  
|- 调用1次
- 连续调用多次（可以通过for循环实现）
|  
|  
|  
|
|规格,**（补充）**|  
|- 构造参数  owner返回值最长值（user最长64个字符）
- 构造plsql名称最大边界值 – 多少？？
- 构造  lineno  超过number最大值的场景  --代码块通过null填充；
|  
|  
|  
|
|权限,**（补充）**|/|前置条件：,- user1 没有plsql权限，sys用户创建过程体，指定schema为user1,
- user2有plsql权限，创建proc2
,覆盖场景：,- proc1调用高级包，proc2调用proc1，sys用户执行proc2
- proc1调用高级包，proc2调用proc1，user1执行proc2
- proc2调用高级包，proc1调用proc2，sys用户执行proc1
- proc2调用高级包，proc1调用proc2，user1用户执行proc1
|  
|  
|  
|
|异常场景|/|- drop     `WA_UTIL.WHO_CALLED_ME 高级包后，重启数据库；查看dba_objects视图`  
- 删库重建，查看dba_objects视图
|/|/|/|
|**升级**|**/**|**22.2.5.0补丁版本合入时，是否还是采用不合入版本，在升级工具中加上创建脚本？？？**|**TODO：22.2.5.0版本交付时，需要确认**|  
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
