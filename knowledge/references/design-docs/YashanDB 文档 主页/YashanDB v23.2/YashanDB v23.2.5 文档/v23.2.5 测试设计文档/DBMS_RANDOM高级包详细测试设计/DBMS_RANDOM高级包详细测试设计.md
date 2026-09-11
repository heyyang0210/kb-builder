Created by 唐文林, last modified on 四月 24, 2024

# **DBMS_RANDOM功能测试设计**

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

该    `DBMS_RANDOM高级`    包提供了一个内置的随机数生成器。    `DBMS_RANDOM`    不适用于密码学。

# 2. 需求分析

## 2.1 语法

```
1.INITIALIZE函数：（Oracle的11gR1已废弃此函数）
 
INITIALIZE ：
DBMS_RANDOM.INITIALIZE (
val IN BINARY_INTEGER);
 
 
2.NORMAL函数：（返回number类型）
DBMS_RANDOM.NORMAL
  RETURN NUMBER;
 
 
3.RSTRINGANDOM接口：(返回大于或等于 -power(2,31) 且小于 power(2,31) 的随机整数)（返回integer类型）
DBMS_RANDOM.RANDOM
   RETURN binary_integer;
 
 
4.SEED函数：（种子可以是长度最大为 2000 的字符串。）
① DBMS_RANDOM.SEED (
   val  IN  BINARY_INTEGER);
 
② DBMS_RANDOM.SEED (
   val  IN  VARCHAR2);
 
 
5.STRING函数：（返回varcher类型）
DBMS_RANDOM.STRING
   opt  IN  CHAR,
   len  IN  NUMBER)
  RETURN VARCHAR2;
 
 
6.VALUE函数：（函数获取一个大于等于0且小于1的随机数，小数点右边38位（38位精度）。或者，您可以获得一个随机的数字 x，其中 x 大于或等于low且小于high。）（返回number类型）
DBMS_RANDOM.VALUE
  RETURN NUMBER;
 
DBMS_RANDOM.VALUE(
  low  IN  NUMBER,
  high IN  NUMBER)
RETURN NUMBER;
```

  


## 2.2 参数

参数：（）

STRING函数：

①opt：

指定返回字符串的样子：

- 'u', 'U' - 返回大写字母字符的字符串
- 'l', 'L' - 返回小写字母字符的字符串
- 'a', 'A' - 返回混合大小写字母字符的字符串
- 'x', 'X' - 返回大写字母数字字符的字符串
- 'p', 'P' - 返回任何可打印字符的字符串。


否则，返回的字符串为大写字母字符。

  


②  len：返回字符串的长度

  


VALUE函数：

①、l  ow：生成随机数的范围中的最小数字。生成的数量可能等于  low

②、high：低于该数字的最高数字将生成随机数。生成的数量将小于  high

  


## 2.3 规格约束

权限约束：  需要显式授予需要执行此包的用户    `EXECUTE`    权限，而不应依赖    `PUBLIC EXECUTE`    权限

# 3. 详细测试设计

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

  


**DBMS_RANDOM.INITIALZE(seed IN INTEGER)：无返回值**

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|参数校验|参数个数|1个|0个，大于1个|
||参数类型|1、integer类型，与integer能隐式转换的类型，科学计数法,2、使用函数返回值最为入参,3、特殊值：null、''|不能与integer类型进行转换的（显示转换，隐形转换）、特殊字符、表情等|
||参数值|[-2  31  , 2  31     - 1]、做四则运算|大于或者小于  [-2  31  , 2  31     - 1]|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|


  


DBMS_RANDOM.NORMAL：  返回  服从正态分布  的随机数，无参数，'()'可省略。

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|参数校验    
    
|参数个数|0个|大于0个|
||参数类型|/|/|
||参数值|/|/|
|关键字校验|/|1、高级包名称及其子函数大小写,2、高级包的"()"可以忽略|1、  高级包名称及其子函数拼写有误,2、高级包的"()"错误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确  --  number类型|/|
||返回值|返回一个任意的number类型（返回值都是随机的，考虑用ha框架）|/|


  


DBMS_RANDOM.RANDOM：  返回随机数，无参数，'()'可省略。

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|参数校验    
    
|参数个数|0个|大于0个|
||参数类型|/|/|
||参数值|/|/|
|关键字校验|/|1、高级包名称及其子函数大小写,2、高级包的"()"可以忽略|1、  高级包名称及其子函数拼写有误,2、高级包的"()"错误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确  --integer  类型|/|
||返回值|返回大于或等于 -power(2,31) 且小于 power(2,31) 的随机整数（返回值都是随机的，考虑用ha框架）|/|


  


DBMS_RANDOM.SEED(seed IN INTEGER)：同DBMS_RANDOM.INITIALZE。无返回值

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|参数校验    
    
|参数个数|1个|0个，大于1个|
||参数类型|1、integer类型，与integer能隐式转换的类型。科学计数法,2、使用函数返回值最为入参,3、特殊值：null、''|不能与integer类型进行转换的（显示转换，隐形转换），特殊字符，表情等|
|||varchar类型|不能与varchar类型进行转换的（显示转换，隐形转换）|
||参数值|[-2  31  , 2  31     - 1]、做四则运算|大于或者小于  [-2  31  , 2  31     - 1]|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|


  


DBMS_RANDOM.STRING:

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|有参数校验    
    
|参数个数|2个|大于2个，小于2个|
||参数类型|opt：char类型（同char能隐式转换的）。使用函数返回值最为入参|非char类型且不能与char能隐式转换的|
|||len：number（同number能隐式转换的类型 ）。使用函数返回值最为入参,  
|非number类型且不能与number能隐式转换的|
||参数值|opt：,字符串格式：    
  * 'x','X'：返回包括数字与大写字母的字符串    
  * 'u','U'：返回只有大写字母的字符串    
  * 'l','L'：返回只有小写字母的字符串    
  * 'a','A'：返回包括大小写字母的字符串    
  * 'p','P'：返回任一ASCII码字符|非字符串格式中的字符，特殊字符，表情等,x,u,l,a,p组合，多个x或者多个u的情况|
|||len：null，''空串，小数（四舍五入），8k，32k|负值，超过32k|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|1、返回  VARCHAR2类型,2、返回字符串长度要与len一致|/|


  


DBMS_RANDOM.VALUE：  生成一个指定范围的38位随机小数（小数点后38位），参数可省略，表示不指定范围，则生成范围为    `[0,1)`    的38位随机数。

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|参数校验    
    
|参数个数|2个，0个|大于2个，小于2个大于0个|
||参数类型|low  ：生成随机数的范围中的最小数字。生成的数量可以等于low,1、number类型（同number能隐式转换的类型 ）。使用函数返回值最为入参,2、当不指定时low的值时，默认值为：0|1、非number类型切不能与number能隐式转换的类型，特殊字符，表情,2、low>high,3、参数值为：8k、32k|
|||high：低于该数字的最高数字将生成随机数。生成的数量不能大于high,1、number类型（同number能隐式转换的类型 ）。使用函数返回值最为入参,2、当不指定时high的值时，默认值为1||
||参数值|number类型的范围、null、''、做四则运算||
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|number类型|/|


  


使用场景：

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL,  
|create时函数返回值作为列的默认值|  
|
||alter时函数返回值作为列的default默认值|  
|
|DML,  
|insert|函数返回值作为values|
||update|函数返回值作为条件|
||delete|  [YDBRD-23418](https://jira.yasdb.com/browse/YDBRD-23418?src=confmacro)    -  【CCB转需求】支持不确定性质的表达式的唯一性生成  待内部评审  需求单还没做，此处是bug|
||filter条件|  [YDBRD-22135](https://jira.yasdb.com/browse/YDBRD-22135?src=confmacro)    -  CLONE-【dbms_random】delete时filter条件调用dbms_random，无法匹配删除  问题已转需求  需求单还没做，此处是bug|
|DQL,  
|作为select投影列返回|  
|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|  
|
||结合group by分组(聚合函数)|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||参与运算|+ - * /  > < >= <=  and or|
|plsql|子函数之间结合使用。INITIALIZE、SEED初始化种子值。使用其他函数生成随机值|  
|
||变量赋值|  
|
||静态sql投影列，  filter位置|  
|
||动态sql的绑定参数传入|  
|
||变量调用：|做默认值、做自定义函数入参、做高级包入参、做内置函数入参、类型继承（%type、%rowtype）|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

yasft，ha框架

# 6. 测试环境说明

*Linux系统*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWE0MDlhMWFkOWEzMzExZGQ1YTY1IiwicmVmX2lkIjoiNjczOWE0MDk1OTNmOTljOWZmMjRiZmNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMzM5LCJleHAiOjE3ODIzOTg3Mzl9.Qm261UC-7SEnSf7YcH-x_raDcFz8ckqhaox32Glf490)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWE0MDlhMWFkOWEzMzExZGQ1YTY1IiwicmVmX2lkIjoiNjczOWE0MDk1OTNmOTljOWZmMjRiZmNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMzM5LCJleHAiOjE3ODIzOTg3Mzl9.Qm261UC-7SEnSf7YcH-x_raDcFz8ckqhaox32Glf490)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWE0MDlhMWFkOWEzMzExZGQ1YTY2IiwicmVmX2lkIjoiNjczOWE0MDk1OTNmOTljOWZmMjRiZmNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMzM5LCJleHAiOjE3ODIzOTg3Mzl9.nfVILuy7bEJKG0HqPlb_c7s0Y-gMAr0UD7dvPww2dJU)

 (application/msword)    


## Comments:

|  [](null)  ,1.string: plsql能处理的最大字符串长度；表中能容纳的最大字符串长度；,opt的各个参数的生效情况检查,nchar ，nvarchar, char(n char)等数据类型传入string的数据；,拼接，字符串处理函数传入等,2.数值类型：,构造大量的数据，查最大，最小，平均值等验证数据分布，也有相关的计算函数。,  
,Posted by zhangxin at 四月 25, 2024 19:23|
|---|
