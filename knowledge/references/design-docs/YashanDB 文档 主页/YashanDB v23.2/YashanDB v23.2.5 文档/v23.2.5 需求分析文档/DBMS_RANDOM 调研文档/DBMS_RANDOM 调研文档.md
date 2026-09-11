Created by 唐文林, last modified on 四月 12, 2024

  [Oracle官方文档](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_RANDOM.html#GUID-EC6DBE0F-81FB-4F55-890E-05E9074864EC)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=95110831#1-overview%E6%A6%82%E8%BF%B0)  

该    `DBMS_RANDOM`    软件包提供了一个内置的随机数生成器。    `DBMS_RANDOM`    不适用于密码学。

  


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95110831#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1、函数个数：

Oracle：7个（多了一个TERMINATE函数     ）

yashan：6个

2、语法

```
1.INITIALIZE接口：

INITIALIZE ：
DBMS_RANDOM.INITIALIZE (
val IN BINARY_INTEGER);


2.NORMAL接口：（返回number类型）
DBMS_RANDOM.NORMAL
  RETURN NUMBER;


3.RANDOM接口：(返回大于或等于 -power(2,31) 且小于 power(2,31) 的随机整数)（返回binary_integer类型）
DBMS_RANDOM.RANDOM
   RETURN binary_integer;


4.SEED接口：（种子可以是长度最大为 2000 的字符串。）
① DBMS_RANDOM.SEED (
   val  IN  BINARY_INTEGER);

② DBMS_RANDOM.SEED (
   val  IN  VARCHAR2);


5.STRING接口：（返回varcher类型）
DBMS_RANDOM.STRING
   opt  IN  CHAR,
   len  IN  NUMBER)
  RETURN VARCHAR2;


6.VALUE接口：（函数获取一个大于等于0且小于1的随机数，小数点右边38位（38位精度）。或者，您可以获得一个随机的数字 x，其中 x 大于或等于low且小于high。）（返回number类型）
DBMS_RANDOM.VALUE
  RETURN NUMBER;

DBMS_RANDOM.VALUE(
  low  IN  NUMBER,
  high IN  NUMBER)
RETURN NUMBER;
```

  


3.操作注意事项：

这些操作说明适用于 DBMS_RANDOM。

-   `DBMS_RANDOM.RANDOM `    产生 [-2^^31, 2^^31) 中的整数。
-   `DBMS_RANDOM.VALUE`    生成 [0,1) 范围内的数字，精度为 38 位。


  `DBMS_RANDOM`    可以显式初始化，但在调用随机数生成器之前不需要初始化。如果未执行显式初始化，它将自动使用日期、用户 ID 和进程 ID 进行初始化。

如果此包使用相同的种子播种两次，然后以相同的方式访问，则在两种情况下都会产生相同的结果。

在某些情况下，例如在测试时，您可能希望每次运行的随机数序列都相同。在这种情况下，您可以通过调用 的重载之一使用常量值为生成器播种    `DBMS_RANDOM.SEED`    。要为每次运行产生不同的输出，只需省略对“种子”的调用，系统就会为您选择合适的种子。

  


4.参数：（）

STRING接口：

①opt：

指定返回字符串的样子：

- 'u', 'U' - 返回大写字母字符的字符串
- 'l', 'L' - 返回小写字母字符的字符串
- 'a', 'A' - 返回混合大小写字母字符的字符串
- 'x', 'X' - 返回大写字母数字字符的字符串
- 'p', 'P' - 返回任何可打印字符的字符串。


否则，返回的字符串为大写字母字符。

  


②  len：返回字符串的长度

  


VALUE接口：

①、l  ow：生成随机数的范围中的最小数字。生成的数量可能等于  low

②、high：低于该数字的最高数字将生成随机数。生成的数量将小于  high

  


  


  


权限：

Oracle 建议需要显式授予需要执行此包的用户    `EXECUTE`    权限，而不应依赖    `PUBLIC EXECUTE`    权限。

  
