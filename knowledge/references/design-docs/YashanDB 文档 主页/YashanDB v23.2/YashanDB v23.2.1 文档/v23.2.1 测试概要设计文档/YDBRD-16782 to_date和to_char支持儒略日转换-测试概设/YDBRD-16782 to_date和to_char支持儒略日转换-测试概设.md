Created by 孟麟, last modified on 十一月 28, 2023

IR链接：    [YDBRD-16782](https://jira.yasdb.com/browse/YDBRD-16782?src=confmacro)    -  to_date和to_char支持儒略日转换  完成

## 1. 需求概述

to_date和to_char支持儒略日转换，新增J和JSP 2个格式字符

to_date支持儒略日计数整数转换成日期，to_date(str,‘J’)    
  to_char支持日期按照儒略周期转换成计数，to_char(date,'JSP')

## 2. 功能点

1、to_date，格式字符J和JSP

select to_date(2451545,'J') from dual;

TO_DATE(2451545,'J    
  ------------------    
  01-JAN-00

select to_date(2451545,'JSP') from dual;

TO_DATE(2451545,'J    
  ------------------    
  01-JAN-00

2、to_char，格式字符J和JSP

select to_char(sysdate,'JSP') from dual;

TO_CHAR(SYSDATE,'JSP')    
  ------------------------------------------------------------------------------    
  TWO MILLION FOUR HUNDRED SIXTY THOUSAND TWO HUNDRED SEVENTY-SEVEN

select to_char(sysdate,'J') from dual;

TO_CHAR    
  -------    
  2460277

## 3. 规格约束

1、to_data 表达式范围是

ORA-01854: julian date must be between 1 and 5373484

2、其他待确认

## 4. 主要应用场景

1、应用场景：to_date、to_char函数，通用场景

2、关联场景：新增fmt字符与其他混合使用场景

## 5. 概要测试设计

### 5.1 功能测试设计

1、针对to_date、to_char两个函数新增的使用场景，规格限制，利用等价类、边界值等测试设计方法，输出测试用例

2、覆盖fmt混合使用的场景

3、参考函数顶层设计，覆盖相关场景

### 5.2 DFX测试设计

1、CT/KT：to_date、to_char函数现有专项用例基础上补充新增使用场景

2、其他专项：不涉及

## 6. 测试策略

|测试项|自动化|框架|备注|
|---|---|---|---|
|功能|是|yasft|  
|
|CT/KT|是|testkill|补充语句|
|  
|  
|  
|  
|


## 7. 后续关注(可选)

*依赖特性识别*

*后续测试详细设计中需要关注的内容*