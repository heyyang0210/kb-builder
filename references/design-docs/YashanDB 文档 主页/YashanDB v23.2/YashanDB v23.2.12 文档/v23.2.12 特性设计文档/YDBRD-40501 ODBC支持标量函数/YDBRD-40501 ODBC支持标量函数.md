  [https://pingcode.yasdb.com/pjm/items/67fdffff25474d885471f979?](https://pingcode.yasdb.com/pjm/items/67fdffff25474d885471f979?)  

#YDBRD-40501 ODBC支持标量函数ifnull、concat、SUBSTRING和LEFT



# 1 设计简介

ODBC标量函数是ODBC内部规范要求的，有自己特定格式参数要求的一部分函数，完全属于驱动内部实现。



# 2 特性概述

华测检测目前ODBC使用了大量的ODBC内置的标量函数，崖山目前ODBC没有支持能力，需要紧急支持。



# 3 方案分析

需要实现以下函数：

fn concat}    字符串拼接

{fn ifnull}  判断是否为空，返回非空的第一个元素

{fn substring} 字符串截取

{fn left}  截取元素左边数据

以上四个函数。



# 4 特性设计

## 4.1 总体方案

以上函数，主要在ODBC内部，通过改写sql实现函数



## 4.2 功能设计

功能比较明确，实现方式通过查看pgodbc等，主要通过改写sql来实现。因为ODBC内部缺少功能太多，最简单的方式就是改写sql，替换ODBC内置函数为崖山等价的内置函数。



ifnull改写

select {fn ifnull('a', 'b')} from dual;

select (ifnull('a', 'b')) from dual;



CONCAT改写

select {fn CONCAT('a', 'b')} from dual;

select (CONCAT('a', 'b')) from dual;



substring改写

select {fn substring('asdff', 2, 2)} from dual;

select (substring('asdff', 2, 2)) from dual;



left改写

select {fn left('asdff', 2)} from dual;

select (left('asdff', 2)) from dual;



单引号

’‘ 如果单引号里面，连续的单引号表示转移一个单引号，单引号的解析还是单引号开始单引号结束

双引号

双引号成对解析

注释

/**/ 包裹注释

-- 一行注释数据



{}大括号 ()小括号



获取整词跳过\n 回车



ODBC实现内容：

1. sql的解析(字符解析，单引号处理，注释处理，括号解析处理等) --场景多，odbc原来没有sql基础的解析能力，可能存在问题较多
1. 补充基础的字符串函数


### 4.2.1 流程设计

不涉及

### 4.2.2 关键数据结构设计

不涉及

### 4.2.3 外部依赖接口设计

不涉及

## 4.3 非功能性设计

### 4.3.1 性能设计

不涉及

### 4.3.2 安全性设计

不涉及



# 5 资料设计

ODBC文档中新增对标量函数的支持



# 6 自测用例设计

1. sql中含有正常支持的内置函数结果
1. sql中含有不支持的内置函数结果
1. sql中含有单引号双引号，单引号中包含特殊函数字符 （投影列，包裹符，结果集，函数参数）
1. sql中的换行windows。
1. sql中含有ODBC内置函数多层嵌套
1. sql中含有注释--开发待实现
1. sql中含有大括号，小括号的正常场景和异常场景。
1. json的类型中包含以上特殊字符




# 7 参考资料

不涉及