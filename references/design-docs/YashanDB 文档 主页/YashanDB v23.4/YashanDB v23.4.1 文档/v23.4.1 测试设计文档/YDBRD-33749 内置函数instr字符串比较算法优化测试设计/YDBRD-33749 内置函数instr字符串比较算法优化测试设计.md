Created by 徐瑶, last modified on 十一月 13, 2024

# 1. 概述

本文描述内置函数instr字符串比较算法优化测试设计

## 1.1 相关文档

SR:        [https://pingcode.yasdb.com/pjm/items/67073846e489dd0868f351fc](https://pingcode.yasdb.com/pjm/items/67073846e489dd0868f351fc)    ?    
  #YDBRD-33749 内置函数instr字符串比较算法优化    


开发设计文档：  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6739beee593f99c9ff251e07](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6739beee593f99c9ff251e07)  



# 2. 需求分析

## 2.1 需求来源及功能点分析

需求来源：    [SAISSUE-273](https://jira.yasdb.com/browse/SAISSUE-273?src=confmacro)    -  【南山政数局】【SQL】SQL执行性能差（yashan:7 min ,oracle:15s~10s）  转需求关闭

该需求是为了优化  内置函数instr字符串比较算法

优化点：

- 优化原有字符串模式串匹配算法，使其达到O(n * m)。


- 在正向匹配场景的部分场景上，实现kmp算法，使其达到O(n + m)算法复杂度


需求范围：    
  1、单机、集群和分布式

## 2.2 应用场景

- instr函数是语句中的主要花销


## 2.3 规格约束

- 影响字符集  ：UTF8, GBK, GB18030,UTF16,ISO88591
- kmp算法使用规格
    - 模式串的字节长度小于255
    - 必须是正向匹配
    - 主串的字节长度大于等于模式串字节长度的十倍
- instr函数不是语句中主要时间花销时性能提升不明显或无提升


# 3. 详细测试设计

## 3.1 测试目标

1.本次测试通过使用含有特性包与oracle进行性能比对，  按instr为主要时间花销对比oracle差距在  2-3倍  验收  (排除其他算子影响)，先与oracle比对，有其他因素影响再与基准包比对

2.本次测试使用特性包，与  不含该特性的基准包对比，性能应有较大提升（可通过  时间复杂度计算出来  ）

模式串：m字节

匹配串：n字节

|  
||优化前|优化后|
|:---|---|:---|:---|
|算法时间复杂度|正向|O( (n ^ 2) * m)|暴力算法：O( n * m),KMP: O( n + m)|
||逆向|O( (n ^ 2) * m)|O( n * m)|


## 3.2 详细测试场景

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|---|
|参数类型|模式串与主串数据类型：  CHAR/VARCHAR/NCHAR/NVARCHAR|  
|  
|  
|
|参数字节长度|主串字节长度小于模式串5倍，模式串长度>/=/<255字节,模式串长度大于255字节，主串字节长度>/=/<模式串5倍,模式串长度等于255字节，主串字节长度>/=/<模式串5倍|走暴力匹配算法|  
|  
|
|  
|主串字节长度>/=模式串5倍，模式串长度小于255字节,  
|走kmp算法|  
|  
|
|基本功能|模式串与主串完全匹配,- 主串比模式串长
    - 模式串匹配主串最前面
    - 模式串匹配到主串中部(模式串覆盖  最优与最差场景  )
    - 模式串匹配主串最后(模式串覆盖  最优与最差场景  )
- 主串与模式串一样长
|主串="abcdefg"，子串="cde",最优：  instr('aaaaaaaaaabc', 'bc' )    
  最差：  instr('aaaaaaaaaaab', 'aaaaaab')|  
|  
|
|  
|模式串与主串部分匹配,- 主串比模式串长
- 主串比模式串短
|主串="abcdefg"，子串="cdfg"|  
|  
|
|  
|模式串与主串不匹配|主串="abcdefg"，子串="xyz"|  
|  
|
|  
|主串和模式串有效数据：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，\n、\r转义字符
- 日期、中文、英文、其他语言、表情包
- null值、空串''、空格
|大小写敏感|  
|  
|
|  
|模式串与主串匹配1次：,- occurence，position省略
- occurence=1，position=1
- occurence=1，position>1
,模式串与主串匹配多次：,- occurence>1，position=1
- occurence>1，position>1
- occurence=最后一次匹配次数，position=1
- occurence=最后一次匹配次数，position>1
- occurence>最后一次匹配次数（匹配不上）
|  
|  
|  
|
|  
|- position<length(  主串)
- position>length(主串)
- position=length(主串)
- position为正数-正向匹配
- position为负数-逆向匹配
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
|与其他函数结合|instrb函数    
  position函数    
  replace函数    
  stringToArray    
  strpos函数    
  split函数    
  以上函数嵌套    
    
,高级包dbms_lob.instr(待补充)，只支持正向匹配|测试点覆盖上述，检查结果正确性,oracle无：position、stringToArray、strops、split|  
|  
|
|其他|filter like escape字符串不为空|  
|  
|  
|
|  
|  
|  
|  
|  
|


  


### 3.2.3instr函数性能

在功能测试基础之上需重点关注下在大数据量下测试instr使用暴力算法和kmp算法的处理性能，统计时延和基准版以及oracle对比，简单设计如下几个场景：

1）主串字符串字节长度及正反匹配测试：

**主串行数固定100w行，模式串行数1-10行**  ，模式串和主串覆盖不同字节长度，分别覆盖正向匹配与逆向匹配：

：测试kmp算法 ：复杂度O( (n ^ 2) * m) → O( n + m)

➕➖：测试暴力算法：正向与逆向的复杂度变化：O( (n ^ 2) * m) → O( n * m)

|主串字节长度/模式串字节长度|6|60|120|254|255（边界值验证）|
|:---|---|:---|---|---|:---|
|80| ➖|  
|  
|  
|  
|
|800| ➖|  
|  
|  
|➖➕|
|4000| ➖||||➖➕|
|32000| ➖|  
|  
|  
|➖➕|
|  
|这一列覆盖其他函数：instrb、    
  position、    
  replace、    
  stringToArray、    
  strpos、    
  split性能|  
|  
|  
|  
|


  


2）数据库字符集：

主串行数固定10行，字节长度4000字节，模式串行数100w行，字节长度1-254字节（kmp），字节长度255-400字节（暴力），分别在以下字符集下执行，字节一致预期与utf8相差不大，

|服务端/客户端|utf8|gb18030|gbk|iso88591|  
|
|:---|---|:---|---|:---|---|
|utf8||  
|  
|  
|  
|
|gb18030|  
||  
|  
|  
|
|gbk|  
|  
||  
|  
|
|iso88591|  
|  
|  
||  
|
|utf16||  
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


  


3）匹配次数性能对比：

主串行数固定10行，字节长度32000字节，模式串行数100w行，字节长度1-254字节（kmp），字节长度255-300字节（暴力）

|position/匹配次数  occurence|1|10|100|备注|
|:---|---|:---|---|---|
|1||||匹配次数与消耗时间成正比|
|  
|暴力算法覆盖最优场景：,最差场景：,基于两者之间：|  
|  
|  
|
|  
|正向与逆向时差不多且优于基准版|  
|  
|  
|


  


4）主串内容及匹配次数：覆盖全中文全英文，混合，以及字符不同的重复度，覆盖匹配一次和10次

主串行数固定100w行，字节长度32000字节，模式串行数100w行，字节长度1-254字节（kmp），字节长度255-300字节（暴力）

|主串内容/模式串内容|匹配最开头-1|匹配中间位置-1|匹配最后-1|匹配最开头-10|匹配中间位置-10|匹配最后-10|匹配最开头-100|匹配中间位置-100|匹配最后-100|
|:---|---|:---|---|---|---|---|---|---|---|
|全英文无重复（abcdrfghijklmnopqrst）|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|全英文一半重复(aaaaaabcdefg)|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|全英文重复字符串(abcdabcdabcd)|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|全中文无重复|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|全中文一半重复|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|全中文重复字符串|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|中英特殊字符混合无重复|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|中英特殊字符混合一半重复|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|中英特殊字符混合重复字符串|  
|  
|  
|  
|  
|  
|  
|  
|  
|


*3.3.*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：

# 5. 测试框架设计

1. 功能测试guider框架已满足


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：

计划测试完成时间：

## Attachments:

[image2024-10-10_10-33-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUxYThhMWFkOWEzMzExZGUxY2MwIiwicmVmX2lkIjoiNjczOWUxYTg3MjgyMDZlZmI5MzE2NWMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMjIxLCJleHAiOjE3ODI1NDY2MjF9.H9130luHH9-m5tqz_6MiDpXoEzqeVlac94xBoq1asNk)

 (image/png)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUxYTg4OTcwYzJhZjRmNTM5ZTcxIiwicmVmX2lkIjoiNjczOWUxYTg3MjgyMDZlZmI5MzE2NWMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMjIxLCJleHAiOjE3ODI1NDY2MjF9.t0gWxog_b6wvRWxM6hLvY1IIWkx2AaDtf8IWo4OrZ2E)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUxYThhMWFkOWEzMzExZGUxY2MxIiwicmVmX2lkIjoiNjczOWUxYTg3MjgyMDZlZmI5MzE2NWMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMjIxLCJleHAiOjE3ODI1NDY2MjF9.Q_Sw05l7FaF1QTXG4POEG8g9pjHUTt8io6MRZ_TcrNU)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUxYTg4OTcwYzJhZjRmNTM5ZTcyIiwicmVmX2lkIjoiNjczOWUxYTg3MjgyMDZlZmI5MzE2NWMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMjIxLCJleHAiOjE3ODI1NDY2MjF9.ywVThz-TInA55fuECSk2hL1PbjMfVPU--_a1px2qCW0)

 (image/svg+xml)    
