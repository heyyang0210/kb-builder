Created by 胡晓畔, last modified on 十一月 06, 2024



-   [1. 需求概述](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-1.需求概述)  
-   [2. 友商的实现情况](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-2.友商的实现情况)  
-   [3. 示例](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-3.示例)  
    -   [VALIDATE_PASSWORD_STRENGTH](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-VALIDATE_PASSWORD_STRENGTH)  
-   [4. 参考文档](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-4.参考文档)  
-   [5. 后续关注 ](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-5.后续关注)  




# 1. 需求概述

  [https://pingcode.yasdb.com/pjm/items/670e4b77e489dd0868f7f6d1](https://pingcode.yasdb.com/pjm/items/670e4b77e489dd0868f7f6d1)    ?    
  #YDBRD-34278 【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数

需求场景：

给定一个表示明文密码的参数，此函数返回一个整数来指示密码的强度，如果参数为 NULL，则返回 NULL。返回值范围从 0（弱）到 100（强）。

# 2. 友商的实现情况

|特性|友商|实现情况|
|:---|:---|:---|
|VALIDATE_PASSWORD_STRENGTH|MySQL|该函数可以对一个任意    [字符串](https://so.csdn.net/so/search?q=%E5%AD%97%E7%AC%A6%E4%B8%B2&spm=1001.2101.3001.7020)    组合进行强度检测，返回1-100的某个值，该值代表密码强度。,前提是启用        `validate_password`       组件， 将公开多个系统变量，以便配置密码检查|


插件和组件对应的系统变量说明：

|选项|默认值|  
|  
|
|---|---|---|---|
|validate_password_check_user_name|OFF|设置为ON的时候表示能将密码设置成当前用户名。|会影响函数值|
|validate_password_dictionary_file|  
|用于检查密码的字典文件的路径名，默认为空|会影响函数值|
|validate_password_length|8|密码的最小长度，也就是说密码长度必须大于或等于8|会影响函数值|
|validate_password_mixed_case_count|1|如果密码策略是中等或更强的，validate_password要求密码具有的小写和大写字符的最小数量。对于给定的这个值密码必须有那么多小写字符和那么多大写字符。|会影响函数值|
|validate_password_number_count|1|密码必须包含的数字个数|会影响函数值|
|validate_password_policy|MEDIUM|密码强度检验等级，可以使用数值0、1、2或相应的符号值LOW、MEDIUM、STRONG来指定。,0/LOW：只检查长度。,1/MEDIUM：检查长度、数字、大小写、特殊字符。,2/STRONG：检查长度、数字、大小写、特殊字符、字典文件。|不影响|
|validate_password_special_char_count|1|密码必须包含的特殊字符个数|会影响函数值|


# 3. 示例

## VALIDATE_PASSWORD_STRENGTH

  


|  
|场景|用例|  
|  
|
|---|---|---|---|---|
|1|参数默认值,  
|  
,```
SHOW VARIABLES LIKE 'validate_password%';
```|  
,![](https://pingcode.yasdb.com/atlas/files/public/6739e43d8970c2af4f53a8a9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ),  
,  
|  
|
|2|validate_password_check_user_name|```
set global  validate_password_check_user_name=off;

select validate_password_strength('root'); --25
select validate_password_strength('root1111'); --50
select validate_password_strength('root111126');


set global  validate_password_check_user_name=on;
select validate_password_strength('1'); 
select validate_password_strength('root');  -- 0
select validate_password_strength('root1111');
```|  validate_password_check_user_name 设置打开时,若密码与用户名相同 返回0,  
,反之以长度决定，见 line3,密码length  小于 4  返回 0,length  大于等于4 且小于 值validate_password_length  返回25,  
,length 大于等于值validate_password_length  返回50；默认值为8大于8 返回50；默认值为10 ，大于10 返回50|  
|
|3|validate_password_length |```
set global validate_password_length=10;
select validate_password_strength('12345678'); 

set global validate_password_length=8;
select validate_password_strength('12345678');
```|![](https://pingcode.yasdb.com/atlas/files/public/6739e43d8970c2af4f53a8aa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ)|  
|
|4|validate_password_length ,  
|-- 密码含中文的情况,select validate_password_strength('aaaa111中');,select validate_password_strength('aaaa111中中');,select validate_password_strength('aaaa111中中中');|![](https://pingcode.yasdb.com/atlas/files/public/6739e43d8970c2af4f53a8ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ),**有差异？**,**最终规格应该会改为和mysql一致，一个中文汉字按照 1个字符长度算。**,  
|  
|
|5| validate_password_length |-- 长密码,select validate_password_strength('aaaa1111111111111111111111111111111111111111111111111111111111111111111111111111');,  
  select validate_password_strength(lpad('a',32000,1));|**mysql不会报错？ 长度是否有上限？--此处不对齐，按照崖山规格**,  
,![](https://pingcode.yasdb.com/atlas/files/public/6739e43da1ad9a3311de26fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ),  
|  
|
|6|validate_password_mixed_case_count,  
|```
set global  validate_password_mixed_case_count=1;
show variables like 'validate_password%';
select validate_password_strength('123456aA'); 
select validate_password_strength('123456aAbB'); 

set global  validate_password_mixed_case_count=2;
select validate_password_strength('123456aA'); 
select validate_password_strength('123456aAbB');
```|要求密码具有的小写和大写字符数  最小个数，默认为1  ,![](https://pingcode.yasdb.com/atlas/files/public/6739e43d8970c2af4f53a8ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ),  
,当密码不满足中等强度要求时，似乎函数返回值上限为50 ？|,  
,  
,  
,  
,  
|
|7|validate_password_number_count|```
set global validate_password_number_count=5;
select validate_password_strength('123456aAbB');
```|最少含有的数字个数 + 小写和大写字符数  ，返回 50,  
,![](https://pingcode.yasdb.com/atlas/files/public/6739e43d8970c2af4f53a8ad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ),  
|  
|
|8|validate_password_special_char_count|```
set global validate_password_special_char_count=1;

-- -- length +special_char_count =50
select validate_password_strength('rootroot1a!'); 
-- length +   mixed_case_count + special_char_count =50
select validate_password_strength('1aaaaaaAbB1!'); 
-- length + 数字个数 + mixed_case_count + special_char_count == 100
select validate_password_strength('123456aAbB1!');  

-- length + 数字个数  + special_char_count =50
select validate_password_strength('123456abB1!');
```|密码最少含有的特殊字符 个数,![](https://pingcode.yasdb.com/atlas/files/public/6739e43da1ad9a3311de26fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBVUFBQUFDQUFBSUFBQUFZQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFFQkFDQ0FBQUNBRUFnQUFNQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBSUFBZ0FBQWdBQUFBQW9BQUFBQUFBQUFDQUFBQUFBQUFBQVVBQUFnQUFBQUFBQUJBQUFnQUFBQUFBQ0FBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2MTYsImV4cCI6MTc4MjQ2NjQxNn0.229detcpWX7PtXr1pCCkHwSAmwfRHdUCPMBh9D0IAsQ),  
,满足长度 + 特殊字符或者 大小写 或者数字个数，,则返回50,特殊字符或者 大小写 或者数字个数， 其中有一个不满足 也返回50,全部满足 返回100，与validate_password_policy 设置无关|  
|
|9|validate_password_dictionary_file|```
--cdbb 
set global validate_password_dictionary_file='/data/datafiles/passwd';

-- -- 匹配到 ，返回75
select validate_password_strength('abcdBB123456!');



-- abcdbb   -- 匹配到 ，返回75
set global validate_password_dictionary_file='/data/datafiles/passwd';

select validate_password_strength('abcdBB123456!');

-- abcd    -- 匹配 到 ，返回75
set global validate_password_dictionary_file='/data/datafiles/passwd';

select validate_password_strength('abcdBB123456!');

-- abcdBB -- 匹配 不到 ，返回100
---- 转小写
set global validate_password_dictionary_file='/data/datafiles/passwd';

select validate_password_strength('abcdBB123456!'); 

--abcdbbaa-- 匹配 不到 ，返回100
set global validate_password_dictionary_file='/data/datafiles/passwd';

select validate_password_strength('abcdBB123456!');
```|  
,密码字典设置生效,改变后需要重新设置，否则不生效,  
,取消密码字典可设置为null,  
,  
|  
|
|10|mysql 上下键查找历史命令|当前函数 组件相关设置 查询 ，无法查找|  
,需要确定是否对齐,  
|  
|


  


  


  


# 4. 参考文档

  [https://cunzaima.cn/mysql8.3-zh/dev.mysql.com/doc/refman/8.3/en/validate-password-options-variables.html#sysvar_validate_password.mixed_case_count](https://cunzaima.cn/mysql8.3-zh/dev.mysql.com/doc/refman/8.3/en/validate-password-options-variables.html#sysvar_validate_password.mixed_case_count)  

  


# 5. 后续关注 

1.密码长度设置规格，与mysql保持差异

  


  


  


  


  


## Attachments:

[image2024-10-29_16-22-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0M2M4OTcwYzJhZjRmNTNhOGE2IiwicmVmX2lkIjoiNjczOWU0M2M3MjgyMDZlZmI5MzE3MDE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NjE2LCJleHAiOjE3ODI1NDIwMTZ9.tzJ6n7momOwpPNDgWFQEEdVxOU5dNYw7Y5Z9FlwnUaA)

 (image/png)    


[image2024-10-29_16-31-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0M2M4OTcwYzJhZjRmNTNhOGE4IiwicmVmX2lkIjoiNjczOWU0M2M3MjgyMDZlZmI5MzE3MDE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NjE2LCJleHAiOjE3ODI1NDIwMTZ9.tVvtfCDGaS8k6DPjGpXAcjTD4JQEaYmIzdXrnG9Ez7E)

 (image/png)    


## Comments:

|  [](null)  ,开发调研：    [特性调研-YDBRD-34278：支持VALIDATE_PASSWORD_STRENGTH函数 - YashanDB - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=171076271)  ,开发设计：    [详细设计-YDBRD-34278 支持VALIDATE_PASSWORD_STRENGTH函数 - 邓秋怡 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=171076451)  ,  [【mysql兼容】pwd黑名单 - 史鑫 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=171076071)  ,Posted by huxiaopan at 十月 30, 2024 19:50|
|---|
