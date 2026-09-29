using System;
using System.Text;
using UnityEngine;

namespace EvokeQuest
{
    [Serializable]
    public sealed class EvokeQuestConfig
    {
        private const string RequiredApiBaseUrl = "https://evokeai-production.up.railway.app";

        public string supabaseUrl;
        public string supabaseAnonKey;
        public string apiBaseUrl;

        public static EvokeQuestConfig Load()
        {
            TextAsset resource = Resources.Load<TextAsset>("EvokeQuestConfig");
            if (resource == null)
                throw new InvalidOperationException("Missing Resources/EvokeQuestConfig.json.");

            EvokeQuestConfig config = JsonUtility.FromJson<EvokeQuestConfig>(resource.text);
            if (config == null || string.IsNullOrWhiteSpace(config.supabaseUrl) ||
                string.IsNullOrWhiteSpace(config.supabaseAnonKey) ||
                string.IsNullOrWhiteSpace(config.apiBaseUrl) ||
                config.supabaseUrl.Contains("YOUR_PROJECT") ||
                config.supabaseAnonKey.Contains("YOUR_SUPABASE"))
                throw new InvalidOperationException("Set the Supabase project URL and public anon key in Resources/EvokeQuestConfig.json.");

            config.supabaseUrl = config.supabaseUrl.TrimEnd('/');
            config.apiBaseUrl = config.apiBaseUrl.TrimEnd('/');
            Uri supabaseUri;
            if (!Uri.TryCreate(config.supabaseUrl, UriKind.Absolute, out supabaseUri) ||
                supabaseUri.Scheme != Uri.UriSchemeHttps ||
                !string.IsNullOrEmpty(supabaseUri.UserInfo) ||
                !string.IsNullOrEmpty(supabaseUri.Query) ||
                !string.IsNullOrEmpty(supabaseUri.Fragment))
                throw new InvalidOperationException("Supabase URL must be an HTTPS project URL without credentials, query, or fragment.");

            if (!string.Equals(config.apiBaseUrl, RequiredApiBaseUrl, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The API base URL must remain https://evokeai-production.up.railway.app.");

            if (config.supabaseAnonKey.IndexOf("service_role", StringComparison.OrdinalIgnoreCase) >= 0 ||
                config.supabaseAnonKey.IndexOf("marble", StringComparison.OrdinalIgnoreCase) >= 0 ||
                IsServiceRoleJwt(config.supabaseAnonKey))
                throw new InvalidOperationException("Use only the Supabase public anon key; service-role and Marble credentials are not accepted.");

            return config;
        }

        private static bool IsServiceRoleJwt(string key)
        {
            string[] segments = key.Split('.');
            if (segments.Length != 3) return false;
            try
            {
                string payload = segments[1].Replace('-', '+').Replace('_', '/');
                if (payload.Length % 4 == 2) payload += "==";
                else if (payload.Length % 4 == 3) payload += "=";
                string claims = Encoding.UTF8.GetString(Convert.FromBase64String(payload));
                claims = claims.Replace(" ", string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty).ToLowerInvariant();
                return claims.Contains("\"role\":\"service_role\"");
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}